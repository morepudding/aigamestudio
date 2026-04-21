"use client";

import Image from "next/image";
import { MessageCircle, Sparkles, ArrowRight, Brain } from "lucide-react";
import { ConversationSummary } from "@/lib/types/chat";
import { useChatPanel } from "@/components/chat/ChatPanelProvider";

interface AgentInfo {
  slug: string;
  name: string;
  role: string;
  department: string;
  personality_primary: string;
  personality_nuance?: string;
  backstory?: string;
  icon_url?: string | null;
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

const departmentLabels: Record<string, string> = {
  art: "Art",
  programming: "Programmation",
  "game-design": "Game Design",
  audio: "Audio",
  narrative: "Narration",
  qa: "QA",
  marketing: "Marketing",
  production: "Production",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

export function ChatHubPageClient({
  initialAgents,
  initialConversations,
}: {
  initialAgents: AgentInfo[];
  initialConversations: ConversationSummary[];
}) {
  const { openChat } = useChatPanel();

  const getConvForAgent = (slug: string) =>
    initialConversations.find((conversation) => conversation.agentSlug === slug);

  // Sort: awaiting first
  const sortedAgents = [...initialAgents].sort((a, b) => {
    const aWaiting = initialConversations.find((c) => c.agentSlug === a.slug)?.awaitingUserReply ? 1 : 0;
    const bWaiting = initialConversations.find((c) => c.agentSlug === b.slug)?.awaitingUserReply ? 1 : 0;
    return bWaiting - aWaiting;
  });

  const awaitingCount = initialConversations.filter((c) => c.awaitingUserReply).length;

  return (
    <div className="h-full overflow-y-auto scrollbar-none">
      <div className="mb-5 md:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Messagerie</h1>
            <p className="text-sm text-muted-foreground/60">
              {initialAgents.length} collaborateur{initialAgents.length > 1 ? "s" : ""} disponible{initialAgents.length > 1 ? "s" : ""}
              {awaitingCount > 0 && (
                <span className="ml-2 text-amber-400 font-medium">· {awaitingCount} t'attend{awaitingCount > 1 ? "ent" : ""}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
        {sortedAgents.map((agent) => {
          const gradient = departmentGradients[agent.department] ?? "from-gray-500 to-gray-600";
          const initials = getInitials(agent.name);
          const conv = getConvForAgent(agent.slug);
          const lastMsg = conv?.lastMessage ?? null;
          const isAwaiting = conv?.awaitingUserReply ?? false;
          const discoveryCount = conv?.discoveryCount ?? 0;

          return (
            <button
              key={agent.slug}
              onClick={() => openChat(agent.slug)}
              className={`group rounded-2xl border transition-all duration-300 overflow-hidden text-left ${
                isAwaiting
                  ? "border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.07] shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${gradient} ${isAwaiting ? "opacity-100" : "opacity-60"}`} />

              <div className="p-4 md:p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shadow-lg overflow-hidden`}>
                      {agent.icon_url ? (
                        <Image
                          src={agent.icon_url}
                          alt={agent.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
                      {isAwaiting && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-300 flex-shrink-0 animate-pulse">
                          t'attend
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/50 truncate mb-1.5">{agent.role}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} bg-opacity-10 text-[10px] font-medium text-white/80`}>
                      {departmentLabels[agent.department] ?? agent.department}
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/50 flex-shrink-0 mt-1" />
                </div>

                <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border ${
                  isAwaiting
                    ? "border-amber-500/20 bg-amber-500/[0.05]"
                    : "border-white/[0.06] bg-white/[0.02]"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isAwaiting ? "bg-amber-500/15" : "bg-blue-500/10"}`}>
                    <MessageCircle className={`w-4 h-4 ${isAwaiting ? "text-amber-400" : "text-blue-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {lastMsg ? (
                      <p className={`text-[11px] truncate ${isAwaiting && lastMsg.sender === "agent" ? "text-amber-200/70" : "text-muted-foreground/50"}`}>
                        {lastMsg.sender === "user" && <span className="text-muted-foreground/30">Vous : </span>}
                        {lastMsg.sender === "agent" && isAwaiting && <span className="text-amber-400/70">{agent.name} : </span>}
                        {truncate(lastMsg.content, 50)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/40">Démarrer la conversation</p>
                    )}
                  </div>
                  {discoveryCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/10 text-[10px] text-violet-400 flex-shrink-0">
                      <Brain className="w-2.5 h-2.5" />
                      {discoveryCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {initialAgents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-primary/[0.08] border border-primary/10 flex items-center justify-center">
              <MessageCircle className="w-9 h-9 text-primary/40" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Aucun collaborateur</h2>
          <p className="text-sm text-muted-foreground/50 max-w-sm leading-relaxed">
            Recrutez des collaborateurs pour commencer à discuter avec eux.
          </p>
        </div>
      )}
    </div>
  );
}