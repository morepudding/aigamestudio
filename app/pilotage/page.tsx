"use client";

import { useEffect, useState, useCallback } from "react";
import { Eye, Save, Loader2, Settings2, FolderGit2, Users, ScrollText } from "lucide-react";

interface StudioContextData {
  projects: string;
  team: string;
  conventions: string;
  full: string;
}

export default function PilotagePage() {
  const [context, setContext] = useState<StudioContextData | null>(null);
  const [conventions, setConventions] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch("/api/studio-context");
      if (res.ok) {
        const data: StudioContextData = await res.json();
        setContext(data);
        setConventions(data.conventions);
        setDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/studio-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conventions }),
      });
      if (res.ok) {
        setSaved(true);
        setDirty(false);
        // Refresh context preview
        await fetchContext();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement du contexte…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 text-sm font-medium mb-2 text-primary">
          <Settings2 className="w-4 h-4" />
          <span className="uppercase tracking-widest text-xs">Pilotage</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          Contexte Studio
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Ce que tes agents IA savent du studio. Les projets et l&apos;équipe sont déduits
          automatiquement de la base. Les conventions sont éditables par toi.
        </p>
      </header>

      {/* ── Auto blocks (read-only) ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ContextCard
          icon={<FolderGit2 className="w-4 h-4" />}
          title="Projets en cours"
          content={context?.projects || "Aucun projet actif."}
          auto
        />
        <ContextCard
          icon={<Users className="w-4 h-4" />}
          title="Équipe"
          content={context?.team || "Aucun collaborateur actif."}
          auto
        />
      </div>

      {/* ── Conventions (editable) ── */}
      <section className="rounded-2xl border border-white/10 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Conventions studio</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/10 text-primary hover:bg-primary/20"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Écris ici les règles fixes du studio : moteur, style artistique, contraintes techniques, etc.
          Ce texte est injecté tel quel dans le contexte des agents.
        </p>
        <textarea
          value={conventions}
          onChange={(e) => {
            setConventions(e.target.value);
            setDirty(true);
          }}
          placeholder="Ex: On utilise Godot 4. Art style pixel-art 32x32. Pas de micro-transactions. Cible PC + Switch."
          rows={6}
          className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y"
        />
      </section>

      {/* ── Full context preview ── */}
      <section className="rounded-2xl border border-white/10 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Aperçu complet</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
            Read-only
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Voici le bloc exact injecté dans le system prompt de chaque agent.
        </p>
        <pre className="bg-background border border-white/10 rounded-xl p-4 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-80">
          {context?.full || "—"}
        </pre>
      </section>
    </div>
  );
}

function ContextCard({
  icon,
  title,
  content,
  auto,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  auto?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h2 className="font-semibold text-foreground text-sm">{title}</h2>
        </div>
        {auto && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
            Auto
          </span>
        )}
      </div>
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
        {content}
      </pre>
    </div>
  );
}
