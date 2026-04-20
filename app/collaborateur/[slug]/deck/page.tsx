"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  Loader2,
  BookOpen,
  MessageCircle,
  Sparkles,
} from "lucide-react";

type CardType = "anecdote" | "question" | "relance" | "reaction";

interface ProposedCard {
  id: string;
  agent_slug: string;
  card_type: CardType;
  content: string;
  themes: string[];
  min_confidence: number;
  accepted: boolean | null;
}

const TYPE_META: Record<CardType, { label: string; color: string; icon: string }> = {
  anecdote: { label: "Anecdote", color: "text-amber-400", icon: "💬" },
  question: { label: "Question", color: "text-sky-400", icon: "❓" },
  relance: { label: "Relance", color: "text-emerald-400", icon: "🔄" },
  reaction: { label: "Réaction", color: "text-violet-400", icon: "⚡" },
};

const SWIPE_THRESHOLD = 80; // px

export default function DeckProposePage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [agentName, setAgentName] = useState<string>("");
  const [card, setCard] = useState<ProposedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [history, setHistory] = useState<ProposedCard[]>([]);
  const [decision, setDecision] = useState<"accepted" | "refused" | null>(null);

  // Swipe state
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);

  // Fetch agent name
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/agents/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setAgentName(data.name);
      })
      .catch(() => {});
  }, [slug]);

  const fetchCard = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setDecision(null);
    setDragX(0);
    try {
      const res = await fetch("/api/deck/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSlug: slug }),
      });
      if (!res.ok) throw new Error("propose failed");
      const data = await res.json();
      setCard(data.card);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const decide = useCallback(
    async (accepted: boolean) => {
      if (!card || deciding) return;
      setDeciding(true);
      const label = accepted ? "accepted" : "refused";
      setDecision(label);

      await fetch("/api/deck/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, accepted }),
      });

      setHistory((prev) => [{ ...card, accepted }, ...prev.slice(0, 9)]);

      // Short delay to show the decision animation, then fetch next
      await new Promise((r) => setTimeout(r, 600));
      setCard(null);
      setDecision(null);
      setDeciding(false);
      await fetchCard();
    },
    [card, deciding, fetchCard]
  );

  // ── Touch / Mouse swipe handlers ──────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (!card || deciding || loading) return;
    dragStartX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    setDragX(e.clientX - dragStartX.current);
  };

  const onPointerUp = () => {
    if (dragStartX.current === null) return;
    dragStartX.current = null;
    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      decide(dragX > 0);
    } else {
      setDragX(0);
    }
  };

  const swipeRotation = dragX / 12;
  const swipeOpacity = Math.max(0, 1 - Math.abs(dragX) / 350);

  // Decision overlay direction
  const showAccept = decision === "accepted" || (dragX > SWIPE_THRESHOLD * 0.6);
  const showRefuse = decision === "refused" || (dragX < -SWIPE_THRESHOLD * 0.6);

  const meta = card ? TYPE_META[card.card_type] : null;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link
          href={`/collaborateur/${slug}`}
          className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <BookOpen size={16} className="text-white/40" />
        <span className="text-sm text-white/60">
          Deck de{" "}
          <span className="text-white font-medium">{agentName || slug}</span>
        </span>
      </header>

      {/* Accepted count badge */}
      {history.filter((c) => c.accepted).length > 0 && (
        <div className="px-4 py-1">
          <span className="text-xs text-emerald-400/70 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            +{history.filter((c) => c.accepted).length} carte
            {history.filter((c) => c.accepted).length > 1 ? "s" : ""} ajoutée
            {history.filter((c) => c.accepted).length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Main swipe area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-6">
        {/* Card */}
        <div className="relative w-full max-w-sm" style={{ minHeight: 280 }}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/30">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">
                <Sparkles size={12} className="inline mr-1" />
                L'IA propose…
              </span>
            </div>
          )}

          {!loading && card && (
            <div
              ref={cardRef}
              className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 cursor-grab active:cursor-grabbing select-none"
              style={{
                transform: `translateX(${dragX}px) rotate(${swipeRotation}deg)`,
                opacity: swipeOpacity,
                transition: dragStartX.current !== null ? "none" : "transform 0.3s ease, opacity 0.3s ease",
                touchAction: "none",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* Accept overlay */}
              <div
                className="absolute inset-0 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center transition-opacity"
                style={{ opacity: showAccept ? 1 : 0, pointerEvents: "none" }}
              >
                <Check size={48} className="text-emerald-400" />
              </div>

              {/* Refuse overlay */}
              <div
                className="absolute inset-0 rounded-2xl bg-red-500/20 border-2 border-red-400 flex items-center justify-center transition-opacity"
                style={{ opacity: showRefuse ? 1 : 0, pointerEvents: "none" }}
              >
                <X size={48} className="text-red-400" />
              </div>

              {/* Type badge */}
              <div className={`flex items-center gap-1.5 mb-4 text-xs font-medium ${meta?.color}`}>
                <span>{meta?.icon}</span>
                <span>{meta?.label}</span>
                {card.min_confidence > 0 && (
                  <span className="ml-auto text-white/30 text-[10px]">
                    confiance ≥{card.min_confidence}
                  </span>
                )}
              </div>

              {/* Content */}
              <p className="text-white/90 text-base leading-relaxed">{card.content}</p>

              {/* Themes */}
              {card.themes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4">
                  {card.themes.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !card && (
            <div className="flex flex-col items-center justify-center gap-3 text-white/30 py-10">
              <MessageCircle size={28} />
              <span className="text-sm">Aucune carte disponible</span>
            </div>
          )}
        </div>

        {/* Swipe hint */}
        {!loading && card && (
          <p className="text-xs text-white/20 text-center">
            Glisse à droite pour ajouter · à gauche pour refuser
          </p>
        )}

        {/* Action buttons */}
        {!loading && card && (
          <div className="flex items-center gap-6">
            <button
              onClick={() => decide(false)}
              disabled={deciding}
              className="w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-40"
              aria-label="Refuser"
            >
              <X size={22} />
            </button>

            <button
              onClick={fetchCard}
              disabled={deciding || loading}
              className="w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40"
              aria-label="Régénérer"
              title="Proposer une autre carte"
            >
              <RefreshCw size={15} />
            </button>

            <button
              onClick={() => decide(true)}
              disabled={deciding}
              className="w-14 h-14 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-40"
              aria-label="Accepter"
            >
              <Check size={22} />
            </button>
          </div>
        )}
      </main>

      {/* History strip */}
      {history.length > 0 && (
        <footer className="px-4 pb-6">
          <p className="text-[10px] text-white/20 mb-2 uppercase tracking-wider">Historique</p>
          <div className="flex flex-col gap-2">
            {history.slice(0, 5).map((h) => {
              const hMeta = TYPE_META[h.card_type];
              return (
                <div
                  key={h.id}
                  className="flex items-start gap-2 text-xs text-white/40 bg-white/3 rounded-lg px-3 py-2"
                >
                  <span>{hMeta.icon}</span>
                  <span className="flex-1 line-clamp-1">{h.content}</span>
                  {h.accepted ? (
                    <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <X size={12} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
