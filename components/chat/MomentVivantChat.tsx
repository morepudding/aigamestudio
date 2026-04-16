"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Sparkles } from "lucide-react";
import Image from "next/image";
import type { MomentVivantScenario, MomentVivantPlaythrough, MomentVivantContinuation } from "@/lib/types/momentVivant";
import { saveAgentMemories } from "@/lib/services/memoryService";

interface AgentInfo {
  slug: string;
  name: string;
  role: string;
  department: string;
  icon_url?: string | null;
  personality_primary: string;
}

interface MomentVivantChatProps {
  agent: AgentInfo;
  scenario: MomentVivantScenario;
  gradient: string;
  initials: string;
  onClose: () => void;
}

type ChatItem =
  | { type: "agent"; content: string; key: string }
  | { type: "choices"; choices: [string, string, string]; key: string }
  | { type: "player"; content: string; key: string };

export function MomentVivantChat({
  agent,
  scenario,
  gradient,
  initials,
  onClose,
}: MomentVivantChatProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [currentReplique, setCurrentReplique] = useState<string>("");
  const [currentChoices, setCurrentChoices] = useState<[string, string, string] | null>(null);
  const [exchangeNumber, setExchangeNumber] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [playthrough, setPlaythrough] = useState<MomentVivantPlaythrough["exchanges"]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Marquer comme opened
  useEffect(() => {
    fetch(`/api/moment-vivant/${agent.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ momentId: scenario.id, status: "opened" }),
    }).catch(() => {});
  }, [agent.slug, scenario.id]);

  // Afficher la première réplique depuis le seed
  useEffect(() => {
    const seed = scenario.scene;
    if (!seed?.firstReplique) return;

    setIsTyping(true);
    setCurrentReplique(seed.firstReplique);
    setCurrentChoices(seed.firstChoices);

    const timer = setTimeout(() => {
      setIsTyping(false);
      setItems([
        { type: "agent", content: seed.firstReplique, key: "exchange-1-agent" },
        { type: "choices", choices: seed.firstChoices, key: "exchange-1-choices" },
      ]);
    }, 800);

    return () => clearTimeout(timer);
  }, [scenario.scene]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, isTyping]);

  const handleChoice = useCallback(async (choiceIndex: number) => {
    if (!currentChoices || isWaiting) return;

    const chosenText = currentChoices[choiceIndex];
    const replique = currentReplique;

    // Masquer les choix et afficher la réponse du joueur
    setCurrentChoices(null);
    setIsWaiting(true);
    setItems((prev) => {
      const withoutChoices = prev.filter(
        (i) => i.key !== `exchange-${exchangeNumber}-choices`
      );
      return [
        ...withoutChoices,
        { type: "player", content: chosenText, key: `exchange-${exchangeNumber}-player` },
      ];
    });

    // Afficher l'indicateur de frappe
    setIsTyping(true);

    try {
      // Appel live au LLM pour la continuation
      const res = await fetch("/api/ai/moment-vivant/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentSlug: agent.slug,
          situationContext: scenario.scene.situationContext,
          momentType: scenario.momentType,
          exchangeHistory: playthrough,
          latestReplique: replique,
          latestChoice: chosenText,
          exchangeNumber,
          totalExchanges: scenario.scene.totalExchanges,
        }),
      });

      if (!res.ok) throw new Error("Continue failed");

      const data = (await res.json()) as MomentVivantContinuation;

      // Enregistrer dans le playthrough
      const newPlayEntry = {
        replique,
        choixJoueur: chosenText,
        reponseAgent: data.agentResponse,
      };
      const newPlaythrough = [...playthrough, newPlayEntry];
      setPlaythrough(newPlaythrough);

      // Afficher la réponse de l'agent
      setIsTyping(false);
      setItems((prev) => [
        ...prev,
        { type: "agent", content: data.agentResponse, key: `exchange-${exchangeNumber}-reply` },
      ]);

      if (data.isFinal || !data.nextChoices) {
        // Moment terminé
        setCompleted(true);
        saveMemory(newPlaythrough);
        fetch(`/api/moment-vivant/${agent.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ momentId: scenario.id, status: "completed" }),
        }).catch(() => {});
      } else {
        // Prochain échange — extraire la prochaine réplique de l'agent
        // La réponse de l'agent contient sa réaction + transition, les choix sont pour le beat suivant
        const nextExNum = exchangeNumber + 1;
        setCurrentReplique(data.agentResponse);
        setCurrentChoices(data.nextChoices);
        setExchangeNumber(nextExNum);

        // Afficher les choix après un court délai
        setTimeout(() => {
          setItems((prev) => [
            ...prev,
            {
              type: "choices",
              choices: data.nextChoices!,
              key: `exchange-${nextExNum}-choices`,
            },
          ]);
        }, 400);
      }
    } catch {
      // En cas d'erreur, clôturer gracieusement
      setIsTyping(false);
      setItems((prev) => [
        ...prev,
        {
          type: "agent",
          content: "... *sourit* Bon, on se reparle vite.",
          key: `exchange-${exchangeNumber}-reply`,
        },
      ]);
      setCompleted(true);
      if (playthrough.length > 0) {
        saveMemory(playthrough);
      }
    } finally {
      setIsWaiting(false);
    }
  }, [currentChoices, currentReplique, exchangeNumber, isWaiting, playthrough, agent.slug, scenario]);

  async function saveMemory(
    exchanges: MomentVivantPlaythrough["exchanges"]
  ) {
    try {
      const res = await fetch("/api/ai/moment-vivant/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentSlug: agent.slug,
          agentName: agent.name,
          momentType: scenario.momentType,
          exchanges,
        } satisfies MomentVivantPlaythrough),
      });

      if (!res.ok) return;
      const data = await res.json() as { memory?: string };
      if (!data.memory) return;

      await saveAgentMemories([
        {
          agent_slug: agent.slug,
          memory_type: "summary",
          content: `[Moment Vivant — ${scenario.momentType}] ${data.memory}`,
          importance: 4,
        },
      ]);
    } catch {
      // silent
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end pointer-events-none">
      {/* Panel — même position que ChatPanel */}
      <div className="pointer-events-auto w-full max-w-md h-full bg-background border-l border-amber-500/20 shadow-2xl shadow-black/60 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-500/15 bg-amber-500/[0.03] shrink-0">
          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden`}
          >
            {agent.icon_url ? (
              <Image src={agent.icon_url} alt={agent.name} width={32} height={32} unoptimized className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/15">
                <Sparkles className="w-2.5 h-2.5" />
                Moment Vivant
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/50 truncate">{agent.role}</p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/6 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
          {items.map((item) => {
            if (item.type === "agent") {
              return (
                <div key={item.key} className="flex items-end gap-2.5 max-w-[85%]">
                  <div
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[9px] font-bold shrink-0 overflow-hidden`}
                  >
                    {agent.icon_url ? (
                      <Image src={agent.icon_url} alt={agent.name} width={28} height={28} unoptimized className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.06] text-white/90 text-sm leading-relaxed border border-white/[0.06]">
                    {item.content}
                  </div>
                </div>
              );
            }

            if (item.type === "player") {
              return (
                <div key={item.key} className="flex items-end justify-end max-w-[85%] ml-auto">
                  <div className="px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm leading-relaxed shadow-lg shadow-primary/20">
                    {item.content}
                  </div>
                </div>
              );
            }

            if (item.type === "choices") {
              return (
                <div key={item.key} className="flex flex-col gap-2 pt-1">
                  {item.choices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChoice(idx)}
                      className="w-full text-left px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-sm border border-white/[0.06] hover:border-white/[0.12] transition-all"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              );
            }

            return null;
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

          {completed && (
            <div className="flex flex-col items-center gap-3 pt-4 pb-2">
              <div className="text-[11px] text-amber-400/60 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Moment enregistré dans la mémoire
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-white/70 text-sm border border-white/[0.06] transition-colors"
              >
                Retour au chat
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
