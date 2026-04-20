"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { Conversation } from "@/lib/types/chat";
import {
  initConversation,
  sendMessage,
  generateAIReply,
  generateMemoryInterviewReply,
  extractMemories,
  shouldTriggerDiscovery,
} from "@/lib/services/chatService";
import { computeNextNudgeAt } from "@/lib/config/nudgeConfig";
import {
  getAgentMemories,
  buildMemoryContextState,
  processExtractedMemories,
  calculateConfidenceDelta,
  type ExtractedMemoryInput,
  type MemoryType,
} from "@/lib/services/memoryService";
import { supabase } from "@/lib/supabase/client";

interface AgentInfo {
  slug: string;
  name: string;
  role: string;
  department: string;
  personality_primary: string;
  personality_nuance?: string;
  backstory?: string;
  icon_url?: string | null;
  mood?: string | null;
  mood_cause?: string | null;
  confidence_level?: number | null;
}

export default function ChatSlugPage() {
  const params = useParams();
  const router = useRouter();

  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [agentMemories, setAgentMemories] = useState<string>("");
  const [personalMems, setPersonalMems] = useState<string>("");
  const [recentTopics, setRecentTopics] = useState<string>("");
  const [memoriesByType, setMemoriesByType] = useState<Record<string, string>>({});

  // Load agent + conversation
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/agents/${slug}`);
        if (!res.ok) {
          router.push("/chat");
          return;
        }
        const agentData: AgentInfo = await res.json();
        setAgent(agentData);

        // Load memories
        const memories = await getAgentMemories(agentData.slug);
        const memoryContext = buildMemoryContextState(memories);
        setAgentMemories(memoryContext.promptMemories);
        setPersonalMems(memoryContext.personalMemories);
        setRecentTopics(memoryContext.recentTopics);
        setMemoriesByType(memoryContext.memoriesByType);

        // Init or get conversation
        const conv = await initConversation(
          agentData.slug,
          agentData.name,
          agentData.personality_primary,
          agentData.personality_nuance ?? "",
          agentData.role ?? "",
          agentData.backstory ?? "",
          memoryContext.promptMemories
        );

        setConversation(conv);
        setLoading(false);
      } catch {
        router.push("/chat");
      }
    }
    load();
  }, [slug, router]);

  // Supabase Realtime: subscribe to new messages for this conversation
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-messages-${slug}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender: "user" | "agent";
            content: string;
            timestamp: number;
            message_type: "normal" | "discovery";
          };

          setConversation((prev) => {
            if (!prev || prev.id !== row.conversation_id) return prev;
            if (prev.messages.some((m) => m.id === row.id)) return prev;
            return {
              ...prev,
              lastMessageAt: row.timestamp,
              awaitingUserReply: row.sender === "agent",
              messages: [
                ...prev.messages,
                {
                  id: row.id,
                  conversationId: row.conversation_id,
                  sender: row.sender,
                  content: row.content,
                  timestamp: row.timestamp,
                  messageType: row.message_type ?? "normal",
                },
              ],
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!agent || !conversation) return;

      const userMsg = await sendMessage(conversation.id, content, "user");
      if (userMsg) {
        setConversation((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((m) => m.id === userMsg.id)) return prev;
          return {
            ...prev,
            messageCount: prev.messageCount + 1,
            messages: [...prev.messages, userMsg],
          };
        });
      }

      const newCount = conversation.messageCount + 1;
      const isDiscoveryTurn = shouldTriggerDiscovery(newCount, conversation.discoveryRhythm);

      const history = conversation.messages.map((m) => ({
        sender: m.sender,
        content: m.content,
      }));

      const memories = agentMemories;

      setIsTyping(true);

      let reply: string;
      if (isDiscoveryTurn) {
        reply = await generateMemoryInterviewReply(
          {
            name: agent.name,
            role: agent.role,
            personalityPrimary: agent.personality_primary,
            personalityNuance: agent.personality_nuance ?? "",
            backstory: agent.backstory ?? "",
          },
          history,
          content,
          memories
        );
      } else {
        const result = await generateAIReply(
          {
            name: agent.name,
            slug: agent.slug,
            role: agent.role,
            personalityPrimary: agent.personality_primary,
            personalityNuance: agent.personality_nuance ?? "",
            backstory: agent.backstory ?? "",
            mood: agent.mood ?? undefined,
            moodCause: agent.mood_cause ?? undefined,
            confidenceLevel: agent.confidence_level ?? undefined,
          },
          history,
          content,
          memories,
          personalMems,
          recentTopics,
        );
        reply = result.message;
      }

      // Split multi-bubble messages (|||) and send each as a separate message
      const replyParts = reply.split("|||").map((p: string) => p.trim()).filter(Boolean);
      const messageType = isDiscoveryTurn ? "discovery" : "normal";
      const nextNudgeAt = computeNextNudgeAt(agent.personality_primary, 0);

      for (let i = 0; i < replyParts.length; i++) {
        // Small delay between bubbles to simulate real typing
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 800));
        }
        const agentMsg = await sendMessage(
          conversation.id,
          replyParts[i],
          "agent",
          messageType as "normal" | "discovery",
          i > 0, // skipBlockingCheck for follow-up bubbles
          i === replyParts.length - 1
            ? { nextNudgeAt, nudgeCount: 0 }
            : undefined
        );
        if (agentMsg) {
          setConversation((prev) => {
            if (!prev) return prev;
            if (prev.messages.some((m) => m.id === agentMsg.id)) return prev;
            return {
              ...prev,
              awaitingUserReply: true,
              nudgeCount: 0,
              nudgeScheduledAt: i === replyParts.length - 1 ? nextNudgeAt : prev.nudgeScheduledAt,
              messages: [...prev.messages, agentMsg],
            };
          });
        }
      }
      setIsTyping(false);

      // Memory extraction every 5 user messages
      if (newCount % 5 === 0) {
        const messagesForExtraction = [
          ...history,
          { sender: "user", content },
          { sender: "agent", content: reply },
        ];
        extractMemories(
          agent.name,
          agent.role,
          messagesForExtraction,
          memoriesByType
        ).then(async (newMemories) => {
          if (newMemories.length > 0) {
            const currentMemories = await getAgentMemories(agent.slug);
            const extractedMemories: ExtractedMemoryInput[] = newMemories.map((memory) => ({
              type: memory.type as MemoryType,
              content: memory.content,
              importance: memory.importance,
            }));
            const updated = await processExtractedMemories({
              agentSlug: agent.slug,
              agentName: agent.name,
              agentRole: agent.role,
              extractedMemories,
              existingMemories: currentMemories,
              sourceConversationId: conversation.id,
            });
            const memoryContext = buildMemoryContextState(updated);
            setAgentMemories(memoryContext.promptMemories);
            setPersonalMems(memoryContext.personalMemories);
            setRecentTopics(memoryContext.recentTopics);
            setMemoriesByType(memoryContext.memoriesByType);

            // Update confidence based on confidence memories
            const confidenceEntries = newMemories.filter((m) => m.type === "confidence");
            if (confidenceEntries.length > 0) {
              const delta = calculateConfidenceDelta(
                confidenceEntries.map((memory, index) => ({
                  id: `confidence-${index}`,
                  agent_slug: agent.slug,
                  memory_type: "confidence",
                  content: memory.content,
                  importance: memory.importance,
                  source_conversation_id: conversation.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }))
              );
              if (delta !== 0) {
                const currentLevel = agent.confidence_level ?? 0;
                const newLevel = Math.max(0, Math.min(100, currentLevel + delta));
                fetch(`/api/agents/${agent.slug}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ confidence_level: newLevel }),
                }).catch(() => {});
                setAgent((prev) => prev ? { ...prev, confidence_level: newLevel } : prev);
              }
            }
          }
        });

        // Update mood every 5 messages
        fetch("/api/ai/generate-mood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agent.name,
            role: agent.role,
            personalityPrimary: agent.personality_primary,
            personalityNuance: agent.personality_nuance ?? "",
            currentMood: agent.mood ?? "neutre",
            recentMessages: [
              ...history.slice(-6),
              { sender: "user", content },
              { sender: "agent", content: reply },
            ],
            memories,
          }),
        })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data?.mood && data.mood !== (agent.mood ?? "neutre")) {
              fetch(`/api/agents/${agent.slug}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mood: data.mood,
                  mood_cause: data.cause ?? null,
                }),
              }).catch(() => {});
              setAgent((prev) => prev ? { ...prev, mood: data.mood, mood_cause: data.cause ?? null } : prev);
            }
          })
          .catch(() => {});
      }
    },
    [agent, conversation, agentMemories, memoriesByType, personalMems, recentTopics]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
        <MessageCircle className="w-5 h-5 mr-2" />
        Chargement…
      </div>
    );
  }

  if (!agent || !conversation) {
    return null;
  }

  return (
    <div className="flex flex-col h-full -m-6 md:-m-8 lg:-m-12 rounded-none overflow-hidden">
      {/* Top bar with back button */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <button
          onClick={() => router.push("/chat")}
          className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-white/[0.06]">
          <MessageCircle className="w-3 h-3 text-blue-400" />
          <span className="text-[11px] font-medium text-blue-400">Conversation</span>
        </div>
      </div>

      {/* Chat conversation */}
      <div className="flex-1 min-h-0">
        <ChatConversation
          agent={agent}
          conversation={conversation}
          onSendMessage={handleSendMessage}
          isTyping={isTyping}
        />
      </div>
    </div>
  );
}
