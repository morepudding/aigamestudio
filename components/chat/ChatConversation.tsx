import Image from "next/image";
import { Conversation } from "@/lib/types/chat";
import { MessageBubble, DateSeparator } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { Pin, Clock, Sparkles, Heart } from "lucide-react";
import { useEffect, useRef } from "react";

interface AgentInfo {
  slug: string;
  name: string;
  role: string;
  department: string;
  personality_primary: string;
  icon_url?: string | null;
  mood?: string | null;
  mood_cause?: string | null;
  confidence_level?: number | null;
}

interface ChatConversationProps {
  agent: AgentInfo;
  conversation: Conversation;
  onSendMessage: (content: string) => void | Promise<void>;
  isTyping?: boolean;
}

const moodEmojis: Record<string, string> = {
  neutre: "😐",
  enthousiaste: "🤩",
  "frustré": "😤",
  curieux: "🤔",
  fier: "😎",
  inquiet: "😟",
  joueur: "😏",
  nostalgique: "🥹",
  "inspiré": "✨",
  "agacé": "😒",
};

const moodHints: Record<string, { hint: string; intensity: "low" | "medium" | "high" }> = {
  enthousiaste: { hint: "déborde d'énergie", intensity: "high" },
  frustré: { hint: "semble contrariée", intensity: "high" },
  curieux: { hint: "a une question", intensity: "medium" },
  fier: { hint: "veut partager quelque chose", intensity: "medium" },
  inquiet: { hint: "a besoin de vous", intensity: "high" },
  joueur: { hint: "veut s'amuser", intensity: "medium" },
  nostalgique: { hint: "pense à vous", intensity: "low" },
  inspiré: { hint: "a une idée", intensity: "high" },
  agacé: { hint: "attend votre réponse", intensity: "medium" },
  neutre: { hint: "vous a écrit", intensity: "low" },
};

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

export function ChatConversation({
  agent,
  conversation,
  onSendMessage,
  isTyping = false,
}: ChatConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const gradient =
    departmentGradients[agent.department] ?? "from-gray-500 to-gray-600";
  const initials = getInitials(agent.name);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

  // Group messages by date
  const messagesWithDates: Array<
    | { type: "date"; timestamp: number; key: string }
    | { type: "message"; index: number; key: string }
  > = [];
  let lastDate = "";
  conversation.messages.forEach((msg, i) => {
    const date = new Date(msg.timestamp).toDateString();
    if (date !== lastDate) {
      messagesWithDates.push({
        type: "date",
        timestamp: msg.timestamp,
        key: `date-${date}`,
      });
      lastDate = date;
    }
    messagesWithDates.push({ type: "message", index: i, key: msg.id });
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 md:gap-4 md:px-6 md:py-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        <div className="relative">
          {agent.icon_url ? (
            <Image
              src={agent.icon_url}
              alt={agent.name}
              width={40}
              height={40}
              unoptimized
              className="w-10 h-10 rounded-full object-cover shadow-lg"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shadow-lg`}
            >
              {initials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white truncate">
              {agent.name}
            </h2>
            {agent.mood && agent.mood !== "neutre" && (
              <span className="text-sm" title={agent.mood_cause ?? agent.mood}>
                {moodEmojis[agent.mood] ?? "😐"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/50 truncate">
            {agent.role}
          </p>
          {agent.mood && agent.mood !== "neutre" && (() => {
            const moodInfo = moodHints[agent.mood] ?? null;
            if (!moodInfo) return null;
            return (
              <p className={`text-[11px] italic leading-tight animate-in fade-in slide-in-from-left-2 duration-500 ${
                moodInfo.intensity === "high"
                  ? "text-rose-400/80"
                  : moodInfo.intensity === "medium"
                    ? "text-amber-400/80"
                    : "text-muted-foreground/60"
              }`}>
                {moodInfo.intensity === "high" ? (
                  <Heart className="w-2.5 h-2.5 inline mr-1 animate-pulse" />
                ) : moodInfo.intensity === "medium" ? (
                  <Sparkles className="w-2.5 h-2.5 inline mr-1" />
                ) : null}
                {agent.name} {moodInfo.hint}...
              </p>
            );
          })()}
        </div>
        {conversation.awaitingUserReply && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] text-amber-400 font-medium">
              En attente de réponse
            </span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4 space-y-3 scrollbar-none">
        {/* System notice */}
        <div className="flex justify-center py-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
            <Sparkles className="w-3 h-3 text-primary/60" />
            <span className="text-[11px] text-muted-foreground/40">
              Début de la conversation avec {agent.name}
            </span>
          </div>
        </div>

        {messagesWithDates.map((item) => {
          if (item.type === "date") {
            return <DateSeparator key={item.key} timestamp={item.timestamp} />;
          }
          const msg = conversation.messages[item.index];
          return (
            <MessageBubble
              key={item.key}
              message={msg}
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
        onSend={onSendMessage}
        placeholder={`Écrire à ${agent.name}…`}
      />
    </div>
  );
}
