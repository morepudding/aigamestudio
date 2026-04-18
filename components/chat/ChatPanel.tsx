"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X, MessageCircle, ArrowLeft } from "lucide-react";
import { useChatPanel } from "./ChatPanelProvider";
import { ChatInput } from "./ChatInput";
import { MessageBubble, DateSeparator } from "./MessageBubble";
import { Conversation, Message } from "@/lib/types/chat";
import {
  initConversation,
  sendMessage,
  generateAIReply,
  generateMemoryInterviewReply,
  extractMemories,
  shouldTriggerDiscovery,
  getAllConversations,
} from "@/lib/services/chatService";
import {
  getAgentMemories,
  formatMemoriesForPrompt,
  formatPersonalMemories,
  formatRecentTopics,
  saveAgentMemories,
  MemoryType,
} from "@/lib/services/memoryService";
import { supabase } from "@/lib/supabase/client";
import { MoodRing, type Mood } from "@/components/ui/MoodRing";
import { ConfidenceBadge } from "@/components/ui/ConfidenceGauge";
import { TierUnlockPopup } from "@/components/ui/TierUnlockPopup";


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
  confidence_level?: number | null;
}

const departmentGradients: Record<string, string> = {
  art: "from-pink-500 to-rose-600",
  programming: "from-cyan-500 to-blue-600",
  "game-design": "from-amber-500 to-orange-600",
  audio: "from-violet-500 to-purple-600",
  narrative: "from-emerald-500 to-teal-600",
  qa: "from-lime-500 to-green-600",
  marketing: "from-red-500 to-pink-600",
  production: "from-indigo-500 to-blue-600",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChatPanel() {
  const { isOpen, activeAgentSlug, closeChat, openChat, openHub } = useChatPanel();
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  // Hub state
  const [hubAgents, setHubAgents] = useState<AgentInfo[]>([]);
  const [hubConversations, setHubConversations] = useState<Conversation[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [agentMemories, setAgentMemories] = useState<string>("");
  const [personalMems, setPersonalMems] = useState<string>("");
  const [recentTopics, setRecentTopics] = useState<string>("");
  const [tierUnlock, setTierUnlock] = useState<{ tierLabel: string; newLevel: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevSlugRef = useRef<string | null>(null);

  // Load hub (agents + conversations) when panel opens in hub mode
  useEffect(() => {
    if (!isOpen || activeAgentSlug) return;

    async function loadHub() {
      setHubLoading(true);
      try {
        const [agentsRes, conversations] = await Promise.all([
          fetch("/api/agents").then((r) => r.json()),
          getAllConversations(),
        ]);
        setHubAgents(agentsRes as AgentInfo[]);
        setHubConversations(conversations);
      } catch {
        // silent fail
      } finally {
        setHubLoading(false);
      }
    }
    loadHub();
  }, [isOpen, activeAgentSlug]);

  // Load agent + conversation when panel opens
  useEffect(() => {
    if (!isOpen || !activeAgentSlug) {
      return;
    }

    // Don't reload if same agent
    if (prevSlugRef.current === activeAgentSlug && conversation) return;
    prevSlugRef.current = activeAgentSlug;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/agents/${activeAgentSlug}`);
        if (!res.ok) return;
        const agentData: AgentInfo = await res.json();
        setAgent(agentData);

        const memories = await getAgentMemories(agentData.slug);
        const formatted = formatMemoriesForPrompt(memories);
        setAgentMemories(formatted);
        setPersonalMems(formatPersonalMemories(memories));
        setRecentTopics(formatRecentTopics(memories));

        const conv = await initConversation(
          agentData.slug,
          agentData.name,
          agentData.personality_primary,
          agentData.personality_nuance ?? "",
          agentData.role ?? "",
          agentData.backstory ?? "",
          formatted
        );
        setConversation(conv);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeAgentSlug]);

  // Realtime subscription — scoped to the current conversation ID
  useEffect(() => {
    if (!activeAgentSlug || !isOpen || !conversation?.id) return;

    const conversationId = conversation.id;

    const channel = supabase
      .channel(`panel-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
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
            if (!prev || prev.id !== conversationId) return prev;
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
  }, [activeAgentSlug, isOpen, conversation?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!agent || !conversation) return;

      // Capture identifiers at call time to guard against agent switching mid-request
      const agentSlugAtSend = agent.slug;
      const conversationIdAtSend = conversation.id;

      const userMsg = await sendMessage(conversationIdAtSend, content, "user");
      if (userMsg) {
        setConversation((prev) => {
          if (!prev || prev.id !== conversationIdAtSend) return prev;
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
          agentMemories
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
            confidenceLevel: agent.confidence_level ?? 0,
          },
          history,
          content,
          agentMemories,
          personalMems,
          recentTopics,
        );
        reply = result.message;
        if (result.unlockedTier && result.newConfidenceLevel !== undefined) {
          setAgent((prev) => prev ? { ...prev, confidence_level: result.newConfidenceLevel } : prev);
          setTierUnlock({ tierLabel: result.unlockedTier, newLevel: result.newConfidenceLevel });
        } else if (result.newConfidenceLevel !== undefined) {
          setAgent((prev) => prev ? { ...prev, confidence_level: result.newConfidenceLevel } : prev);
        }
      }

      const replyParts = reply.split("|||").map((p: string) => p.trim()).filter(Boolean);
      const messageType = isDiscoveryTurn ? "discovery" : "normal";

      setIsTyping(false);

      for (let i = 0; i < replyParts.length; i++) {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 800));
        }
        const agentMsg = await sendMessage(
          conversationIdAtSend,
          replyParts[i],
          "agent",
          messageType as "normal" | "discovery",
          i > 0
        );
        if (agentMsg) {
          setConversation((prev) => {
            if (!prev || prev.id !== conversationIdAtSend) return prev;
            if (prev.messages.some((m) => m.id === agentMsg.id)) return prev;
            return { ...prev, messages: [...prev.messages, agentMsg] };
          });
        }
      }

      // Memory extraction every 5 user messages
      if (newCount % 5 === 0) {
        const messagesForExtraction = [
          ...history,
          { sender: "user", content },
          { sender: "agent", content: reply },
        ];
        extractMemories(agent.name, agent.role, messagesForExtraction).then(
          async (newMemories) => {
            if (newMemories.length > 0) {
              await saveAgentMemories(
                newMemories.map((m) => ({
                  agent_slug: agentSlugAtSend,
                  memory_type: m.type as MemoryType,
                  content: m.content,
                  source_conversation_id: conversationIdAtSend,
                }))
              );
              // Only refresh memories if still on the same agent
              if (agentSlugAtSend === agent.slug) {
                const updated = await getAgentMemories(agentSlugAtSend);
                setAgentMemories(formatMemoriesForPrompt(updated));
                setPersonalMems(formatPersonalMemories(updated));
                setRecentTopics(formatRecentTopics(updated));
              }
            }
          }
        );
      }
    },
    [agent, conversation, agentMemories, personalMems, recentTopics]
  );


  // Group messages by date
  const messagesWithDates: Array<
    | { type: "date"; timestamp: number; key: string }
    | { type: "message"; msg: Message; key: string }
  > = [];
  if (conversation) {
    let lastDate = "";
    conversation.messages.forEach((msg) => {
      const date = new Date(msg.timestamp).toDateString();
      if (date !== lastDate) {
        messagesWithDates.push({ type: "date", timestamp: msg.timestamp, key: `date-${date}` });
        lastDate = date;
      }
      messagesWithDates.push({ type: "message", msg, key: msg.id });
    });
  }

  const gradient = agent
    ? departmentGradients[agent.department] ?? "from-gray-500 to-gray-600"
    : "from-gray-500 to-gray-600";
  const initials = agent ? getInitials(agent.name) : "?";

  return (
    <>
      {/* Tier unlock VN popup */}
      {tierUnlock && agent && (
        <TierUnlockPopup
          tierLabel={tierUnlock.tierLabel}
          newLevel={tierUnlock.newLevel}
          agentName={agent.name}
          agentPersonality={agent.personality_primary}
          agentImageUrl={agent.icon_url}
          agentGradient={gradient}
          onClose={() => setTierUnlock(null)}
        />
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 lg:hidden"
          onClick={closeChat}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:max-w-md bg-background border-l border-white/10 shadow-2xl shadow-black/40 z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6 bg-white/2 backdrop-blur-sm shrink-0">
          {activeAgentSlug && agent ? (
            <>
              {/* Back to hub */}
              <button
                onClick={openHub}
                className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center transition-colors shrink-0"
                title="Retour aux messages"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <MoodRing
                mood={agent.mood as Mood}
                size="sm"
                imageUrl={agent.icon_url}
                fallbackGradient={gradient}
                initials={initials}
                showOnlineIndicator={true}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
                  {(agent.confidence_level ?? 0) > 0 && (
                    <ConfidenceBadge level={agent.confidence_level ?? 0} />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/50 truncate">{agent.role}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Messages</h3>
                <p className="text-[11px] text-muted-foreground/50">Vos conversations</p>
              </div>
            </>
          )}
          <button
            onClick={closeChat}
            className="w-8 h-8 rounded-lg bg-white/6 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        {!activeAgentSlug ? (
          /* ── Hub view ── */
          hubLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground/50 animate-pulse">
              <MessageCircle className="w-5 h-5 mr-2" />
              Chargement…
            </div>
          ) : (
            <HubList agents={hubAgents} conversations={hubConversations} onSelectAgent={openChat} />
          )
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse">
            <MessageCircle className="w-5 h-5 mr-2" />
            Chargement…
          </div>
        ) : conversation && agent ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-none">
              {messagesWithDates.map((item) => {
                if (item.type === "date") {
                  return <DateSeparator key={item.key} timestamp={item.timestamp} />;
                }
                return (
                  <MessageBubble
                    key={item.key}
                    message={item.msg}
                    agentName={agent.name}
                    agentInitials={initials}
                    agentIconUrl={agent.icon_url ?? null}
                    gradient={gradient}
                  />
                );
              })}

              {isTyping && (
                <div className="flex items-center gap-2 text-muted-foreground/40 text-[10px] pl-10 animate-pulse">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 bg-current rounded-full animate-bounce" />
                  </div>
                  <span>{agent.name} écrit...</span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSendMessage}
              placeholder={`Écrire à ${agent.name}…`}
              disabled={isTyping}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-sm">
            Sélectionnez un collaborateur
          </div>
        )}
      </div>
    </>
  );
}

// ── Hub list ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

function HubList({
  agents,
  conversations,
  onSelectAgent,
}: {
  agents: AgentInfo[];
  conversations: Conversation[];
  onSelectAgent: (slug: string) => void;
}) {
  // Sort: conversations first by recency, then agents without convos
  const sorted = [...agents].sort((a, b) => {
    const ca = conversations.find((c) => c.agentSlug === a.slug);
    const cb = conversations.find((c) => c.agentSlug === b.slug);
    if (ca && cb) return cb.lastMessageAt - ca.lastMessageAt;
    if (ca) return -1;
    if (cb) return 1;
    return 0;
  });

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none">
      {sorted.map((ag) => {
        const conv = conversations.find((c) => c.agentSlug === ag.slug);
        const lastMsg = conv?.messages[conv.messages.length - 1];
        const hasUnread = conv ? !conv.awaitingUserReply : false;
        const gradient = departmentGradients[ag.department] ?? "from-gray-500 to-gray-600";
        const initials = getInitials(ag.name);

        return (
          <button
            key={ag.slug}
            onClick={() => onSelectAgent(ag.slug)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors border-b border-white/4 text-left"
          >
            {/* Avatar with mood ring */}
            <MoodRing
              mood={ag.mood as Mood}
              size="md"
              imageUrl={ag.icon_url}
              fallbackGradient={gradient}
              initials={initials}
              showOnlineIndicator={true}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm truncate ${hasUnread ? "font-semibold text-white" : "font-medium text-white/80"}`}>
                  {ag.name}
                </span>
                {conv && (
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-2">
                    {timeAgo(conv.lastMessageAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-[12px] truncate max-w-50 ${hasUnread ? "text-white/70" : "text-muted-foreground/50"}`}>
                  {lastMsg ? lastMsg.content : ag.role}
                </p>
                {hasUnread && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 ml-2" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
