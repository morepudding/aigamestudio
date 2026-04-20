"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  CheckCircle,
  MessageSquare,
  X,
  ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BrainstormingSession, OnePageComments, OnePageSection } from "@/lib/types/brainstorming";
import type { Project } from "@/lib/types/project";

// ============================================================
// Section labels for comments
// ============================================================

const SECTION_LABELS: Record<OnePageSection, string> = {
  elevatorPitch: "Elevator Pitch",
  playerFantasy: "Player Fantasy",
  coreLoop: "Core Loop",
  univers: "Univers",
  perimetreV1: "Périmètre V1",
  risques: "Risques identifiés",
  integrationVN: "Intégration VN",
};

const SECTIONS: OnePageSection[] = [
  "elevatorPitch",
  "playerFantasy",
  "coreLoop",
  "univers",
  "perimetreV1",
  "risques",
  "integrationVN",
];

// ============================================================
// Comment panel
// ============================================================

function CommentPanel({
  section,
  current,
  onSave,
  onClose,
}: {
  section: OnePageSection;
  current: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(current);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-card border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{SECTION_LABELS[section]}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Ton commentaire sur cette section…"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-sm">
            Annuler
          </button>
          <button
            onClick={() => { onSave(text); onClose(); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// One Page view with per-section comments
// ============================================================

function OnePageView({
  onePage,
  comments,
  onCommentChange,
}: {
  onePage: string;
  comments: OnePageComments;
  onCommentChange: (section: OnePageSection, text: string) => void;
}) {
  const [activePanel, setActivePanel] = useState<OnePageSection | null>(null);

  const sections = SECTIONS.map((key) => {
    const label = SECTION_LABELS[key];
    const comment = comments[key] ?? "";
    const sectionRegex = new RegExp(`## ${label}([\\s\\S]*?)(?=## |$)`, "i");
    const match = onePage.match(sectionRegex);
    const content = match ? match[1].trim() : "";
    return { key, label, content, comment };
  });

  return (
    <>
      <div className="space-y-6">
        {sections.map(({ key, label, content, comment }) => (
          <div key={key} className="group relative">
            <div className="rounded-xl border border-white/8 bg-white/2 p-4 hover:border-white/15 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                <button
                  onClick={() => setActivePanel(key)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    comment
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  {comment ? "Modifier" : "Commenter"}
                </button>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*Non défini*"}</ReactMarkdown>
              </div>
              {comment && (
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                  <p className="text-xs text-amber-300/80 italic">&ldquo;{comment}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {activePanel && (
        <CommentPanel
          section={activePanel}
          current={comments[activePanel] ?? ""}
          onSave={(text) => onCommentChange(activePanel, text)}
          onClose={() => setActivePanel(null)}
        />
      )}
    </>
  );
}

// ============================================================
// Main page
// ============================================================

export default function BrainstormingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<BrainstormingSession | null>(null);
  const [onePage, setOnePage] = useState<string | null>(null);
  const [comments, setComments] = useState<OnePageComments>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasComments = Object.values(comments).some((c) => c && c.trim().length > 0);

  useEffect(() => {
    async function init() {
      try {
        const [projectRes, sessionRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/brainstorming/${projectId}/session`),
        ]);

        if (projectRes.ok) setProject(await projectRes.json());

        if (sessionRes.ok) {
          const data = await sessionRes.json();
          if (data?.session) {
            setSession(data.session);
            if (data.session.onePage) setOnePage(data.session.onePage);
            if (data.session.onePageComments) setComments(data.session.onePageComments);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId]);

  async function handleGenerate(action: "generate" | "regenerate") {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/brainstorming/${projectId}/onepage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comments: action === "regenerate" ? comments : undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la génération");
      }
      const data = await res.json();
      setOnePage(data.onePage);
      setComments({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCommentChange(section: OnePageSection, text: string) {
    const updated = { ...comments, [section]: text };
    if (!text.trim()) delete updated[section];
    setComments(updated);

    await fetch(`/api/brainstorming/${projectId}/onepage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", comments: updated }),
    });
  }

  async function handleValidate() {
    setValidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/brainstorming/${projectId}/onepage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate" }),
      });
      if (!res.ok) throw new Error("Erreur lors de la validation");
      router.push(`/brainstorming/${projectId}/gdd-review`);
    } catch (err) {
      setError((err as Error).message);
      setValidating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span>Catalogue</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{project?.title ?? projectId}</span>
          <ChevronRight className="w-3 h-3" />
          <span>One Page</span>
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">One Page Design Document</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {onePage
            ? "Lis, commente chaque section, puis régénère ou valide."
            : "L'agent va générer le One Page à partir de ton brief."}
        </p>
      </div>

      {/* Brief recap */}
      {session?.gameBrief && (
        <div className="mb-6 p-4 rounded-xl border border-white/8 bg-white/2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="bg-white/8 px-2 py-1 rounded-md">{session.gameBrief.genre}</span>
          <span className="bg-white/8 px-2 py-1 rounded-md">{session.gameBrief.sessionDuration}</span>
          {session.gameBrief.referenceGame && (
            <span className="bg-white/8 px-2 py-1 rounded-md">Réf: {session.gameBrief.referenceGame}</span>
          )}
          <span className="bg-white/8 px-2 py-1 rounded-md flex-1 min-w-0 truncate">{session.gameBrief.theme}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* No One Page yet */}
      {!onePage && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Prêt à générer</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              L&apos;agent va lire ton brief et produire le One Page Design Document.
            </p>
          </div>
          <button
            onClick={() => handleGenerate("generate")}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Génération en cours…" : "Générer le One Page"}
          </button>
        </div>
      )}

      {/* One Page content */}
      {onePage && (
        <>
          <OnePageView
            onePage={onePage}
            comments={comments}
            onCommentChange={handleCommentChange}
          />

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/8">
            <button
              onClick={() => handleGenerate("regenerate")}
              disabled={generating || validating || !hasComments}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/8 text-sm font-medium transition-all disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Régénérer avec mes commentaires
            </button>

            <button
              onClick={handleValidate}
              disabled={validating || generating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Valider le One Page
            </button>
          </div>

          {!hasComments && (
            <p className="text-xs text-muted-foreground/50 text-center mt-3">
              Commente au moins une section pour pouvoir régénérer
            </p>
          )}
        </>
      )}
    </div>
  );
}
