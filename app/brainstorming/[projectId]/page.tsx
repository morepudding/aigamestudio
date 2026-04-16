"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, ChevronRight, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BrainstormingMessage, BrainstormingSession } from "@/lib/types/brainstorming";
import type { Agent } from "@/lib/services/agentService";
import type { Project } from "@/lib/types/project";

// ============================================================
// Types
// ============================================================

type ApiSessionResponse = {
  session: BrainstormingSession;
  messages: BrainstormingMessage[];
};

type ApiMessageResponse = {
  userMessage: BrainstormingMessage;
  agentMessage: BrainstormingMessage | null;
  phaseChanged: boolean;
  currentPhase: string;
  readyForSynthesis?: boolean;
};

// ============================================================
// Phase labels
// ============================================================

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  "game-design": { label: "Game Design", color: "text-violet-300" },
  "programming": { label: "Technique", color: "text-blue-300" },
  "art": { label: "Direction artistique", color: "text-pink-300" },
  "dynamic": { label: "Approfondissement", color: "text-amber-300" },
  "synthesis": { label: "Synthèse", color: "text-emerald-300" },
  "completed": { label: "Terminé", color: "text-emerald-300" },
};

// ============================================================
// Message bubble
// ============================================================

function MessageBubble({
  msg,
  agentsMap,
}: {
  msg: BrainstormingMessage;
  agentsMap: Record<string, Agent>;
}) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  // Skip internal system messages
  if (isSystem && msg.questionKey?.startsWith("__")) return null;

  const agent = msg.agentSlug ? agentsMap[msg.agentSlug] : null;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-primary/20 border border-primary/30 rounded-2xl rounded-br-sm px-4 py-3">
          <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground/60 bg-white/5 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
        {agent?.name.charAt(0) ?? "?"}
      </div>
      <div className="flex-1 max-w-[80%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-foreground">
            {agent?.name ?? msg.agentSlug ?? "Agent"}
          </span>
          {agent?.role && (
            <span className="text-xs text-muted-foreground">{agent.role}</span>
          )}
          {msg.isDynamic && (
            <span className="text-xs bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded-md">
              suivi
            </span>
          )}
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="text-sm text-foreground leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-base font-semibold mt-2 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium mt-2 mb-1.5">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                code: ({ children }) => (
                  <code className="px-1 py-0.5 rounded bg-white/10 text-xs">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-white/10 border border-white/10 rounded-lg p-3 overflow-x-auto mb-3 last:mb-0">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-white/20 pl-3 italic text-muted-foreground mb-3 last:mb-0">
                    {children}
                  </blockquote>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Phase progress bar
// ============================================================

const PHASES_ORDER = ["game-design", "programming", "art", "dynamic", "synthesis"];

function PhaseBar({
  currentPhase,
  phasesCompleted,
}: {
  currentPhase: string;
  phasesCompleted: string[];
}) {
  return (
    <div className="flex items-center gap-1 px-4">
      {PHASES_ORDER.map((phase, i) => {
        const isDone = phasesCompleted.includes(phase);
        const isCurrent = currentPhase === phase;
        const info = PHASE_LABELS[phase];
        return (
          <div key={phase} className="flex items-center gap-1 flex-1">
            <div className="flex-1">
              <div className={`text-xs text-center mb-1 font-medium transition-colors ${
                isCurrent ? info.color : isDone ? "text-muted-foreground" : "text-muted-foreground/30"
              }`}>
                {info.label}
              </div>
              <div className={`h-1 rounded-full transition-all ${
                isDone ? "bg-primary" : isCurrent ? "bg-primary/60 animate-pulse" : "bg-white/10"
              }`} />
            </div>
            {i < PHASES_ORDER.length - 1 && (
              <ChevronRight className={`w-3 h-3 shrink-0 mb-1 ${isDone ? "text-primary/60" : "text-white/15"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function BrainstormingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<BrainstormingSession | null>(null);
  const [messages, setMessages] = useState<BrainstormingMessage[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, Agent>>({});
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [readyForSynthesis, setReadyForSynthesis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load project + session + agents
  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/brainstorming/${projectId}/session`).then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()),
    ]).then(([proj, sessionData, agents]: [Project, ApiSessionResponse | null, Agent[]]) => {
      setProject(proj);
      if (sessionData?.session) {
        setSession(sessionData.session);
        setMessages(sessionData.messages ?? []);
        // If already at synthesis phase or completed
        if (
          sessionData.session.currentPhase === "synthesis" ||
          sessionData.session.currentPhase === "completed"
        ) {
          if (!sessionData.session.scopeSummary) {
            setReadyForSynthesis(true);
          }
        }
        // If scope already generated → redirect to GDD review
        if (sessionData.session.scopeSummary && !sessionData.session.gddFinalized) {
          router.push(`/brainstorming/${projectId}/gdd-review`);
        }
        if (sessionData.session.gddFinalized) {
          router.push(`/projects/${projectId}`);
        }
      }
      const map: Record<string, Agent> = {};
      for (const a of agents) map[a.slug] = a;
      setAgentsMap(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId, router]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending || !session) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/brainstorming/${projectId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      const data: ApiMessageResponse = await res.json();

      // Add messages to state
      const newMsgs: BrainstormingMessage[] = [];
      if (data.userMessage) newMsgs.push(data.userMessage);
      if (data.agentMessage) newMsgs.push(data.agentMessage);
      setMessages((prev) => [...prev, ...newMsgs]);

      // Update session phase
      if (data.phaseChanged && session) {
        setSession((prev) =>
          prev ? { ...prev, currentPhase: data.currentPhase as BrainstormingSession["currentPhase"] } : prev
        );
      }

      if (data.readyForSynthesis) {
        setReadyForSynthesis(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleSynthesize() {
    if (synthesizing) return;
    setSynthesizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/brainstorming/${projectId}/synthesize`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la synthèse");
      }
      // Redirect to GDD review
      router.push(`/brainstorming/${projectId}/gdd-review`);
    } catch (err) {
      setError((err as Error).message);
      setSynthesizing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement du brainstorming…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        Session introuvable. Retourne sur la page projet pour démarrer le brainstorming.
      </div>
    );
  }

  const isCompleted =
    session.currentPhase === "completed" || !!session.scopeSummary;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/8 bg-card/50 backdrop-blur-sm px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-bold text-lg">
                Brainstorming — {project?.title ?? projectId}
              </h1>
              <p className="text-xs text-muted-foreground">
                {session.agentSlugs.map((s) => agentsMap[s]?.name ?? s).join(", ")}
              </p>
            </div>
            <div className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isCompleted
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}>
              {isCompleted ? "Brainstorming terminé" : PHASE_LABELS[session.currentPhase]?.label ?? session.currentPhase}
            </div>
          </div>
          <PhaseBar
            currentPhase={session.currentPhase}
            phasesCompleted={session.phasesCompleted}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages
            .filter((m) => !(m.role === "system" && m.questionKey?.startsWith("__")))
            .map((msg) => (
              <MessageBubble key={msg.id} msg={msg} agentsMap={agentsMap} />
            ))}

          {/* Loading indicator while agent responds */}
          {sending && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              </div>
              <div className="bg-white/5 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Synthesis CTA */}
      {readyForSynthesis && !isCompleted && (
        <div className="shrink-0 border-t border-white/8 bg-emerald-500/5 px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-300">Le brainstorming est terminé !</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prêt à synthétiser le scope et passer à la génération du GDD.
                </p>
              </div>
              <button
                onClick={handleSynthesize}
                disabled={synthesizing}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                {synthesizing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Synthèse en cours…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Générer le scope & le GDD</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed state */}
      {isCompleted && (
        <div className="shrink-0 border-t border-white/8 bg-card/50 px-6 py-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm text-muted-foreground">
              Brainstorming archivé.{" "}
              <button
                onClick={() => router.push(`/brainstorming/${projectId}/gdd-review`)}
                className="text-primary hover:underline font-medium"
              >
                Voir la révision du GDD →
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      {!isCompleted && !readyForSynthesis && (
        <div className="shrink-0 border-t border-white/8 bg-card/50 px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {error && (
              <p className="text-xs text-red-400 mb-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ta réponse… (Entrée pour envoyer, Maj+Entrée pour sauter une ligne)"
                rows={2}
                disabled={sending}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="w-11 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-all disabled:opacity-40 shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
