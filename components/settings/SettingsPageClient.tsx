"use client";

import { useState } from "react";
import { Save, BookOpen, Wrench } from "lucide-react";

interface Props {
  initialConventions: string;
  initialUniverseLore: string;
}

export function SettingsPageClient({ initialConventions, initialUniverseLore }: Props) {
  const [conventions, setConventions] = useState(initialConventions);
  const [universeLore, setUniverseLore] = useState(initialUniverseLore);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conventions, universeLore }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ces informations sont injectées dans tous les prompts IA du studio.
          </p>
        </div>

        {/* Academia Vespana — univers */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-white">Lore — Academia Vespana</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Détails additionnels sur l&apos;univers du VN hôte. Florence &amp; Paris, 1490, école secrète d&apos;espions.
            Étoffez ce champ au fil du projet — il sera injecté dans chaque prompt de design.
          </p>
          <textarea
            value={universeLore}
            onChange={(e) => setUniverseLore(e.target.value)}
            placeholder="Ex: L'Academia Vespana est fondée par Cosimo de Rossi en 1483. Les élèves sont recrutés parmi les orphelins de noble lignée..."
            rows={8}
            className="w-full rounded-xl bg-card/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y font-mono"
          />
        </section>

        {/* Conventions techniques */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-white">Conventions studio</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Règles de développement, conventions de code, standards de design. Injectées dans les contextes agents.
          </p>
          <textarea
            value={conventions}
            onChange={(e) => setConventions(e.target.value)}
            placeholder="Ex: Tous les mini-jeux utilisent Tailwind + React. Pas de bibliothèques tierces sans validation..."
            rows={6}
            className="w-full rounded-xl bg-card/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y font-mono"
          />
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400 animate-in fade-in duration-300">
              Sauvegardé
            </span>
          )}
        </div>

        {/* Info fixe */}
        <section className="rounded-xl border border-white/8 bg-card/30 p-5 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contexte fixe (non modifiable ici)</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Univers de base : Academia Vespana, Florence/Paris 1490, école secrète d&apos;espions</li>
            <li>Plateforme : web React uniquement — aucun build natif</li>
            <li>Monétisation : nulle</li>
            <li>Intégration : window.postMessage avec le VN hôte</li>
            <li>Récompenses globales : à définir quand le VN hôte sera terminé</li>
          </ul>
          <p className="text-xs text-muted-foreground/60 mt-2">Ces contraintes sont encodées dans le code et nécessitent un déploiement pour être modifiées.</p>
        </section>

      </div>
    </div>
  );
}
