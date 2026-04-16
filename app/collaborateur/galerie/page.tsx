"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock, Image as ImageIcon } from "lucide-react";
import { EXCLUSIVE_PHOTO_TIERS } from "@/lib/config/exclusivePhotos";

interface AgentSummary {
  slug: string;
  name: string;
  role: string;
  confidence_level: number | null;
}

function getUnlockedCount(confidenceLevel: number) {
  return EXCLUSIVE_PHOTO_TIERS.filter((tier) => confidenceLevel >= tier.threshold).length;
}

export default function CollaborateurGalleryPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const totalSlots = EXCLUSIVE_PHOTO_TIERS.length;

  const stats = useMemo(() => {
    const totalUnlocked = agents.reduce((sum, agent) => sum + getUnlockedCount(agent.confidence_level ?? 0), 0);
    const totalPossible = agents.length * totalSlots;
    return { totalUnlocked, totalPossible };
  }, [agents, totalSlots]);

  if (loading) {
    return <div className="text-muted-foreground animate-pulse">Chargement de la galerie…</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Link
        href="/collaborateur"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux collaborateurs
      </Link>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Galerie des collaborateurs</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Débloque des photos exclusives selon les points de confiance de chaque collaborateur.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white">
            <ImageIcon className="w-4 h-4 text-cyan-300" />
            {stats.totalUnlocked}/{stats.totalPossible} photos débloquées
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const confidence = agent.confidence_level ?? 0;
          const unlockedCount = getUnlockedCount(confidence);
          const nextTier = EXCLUSIVE_PHOTO_TIERS.find((tier) => confidence < tier.threshold) ?? null;

          return (
            <Link
              key={agent.slug}
              href={`/collaborateur/${agent.slug}/galerie`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors"
            >
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors">{agent.name}</p>
                  <p className="text-sm text-primary">{agent.role}</p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Confiance</span>
                  <span className="text-white font-medium">{confidence} pts</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Photos débloquées</span>
                  <span className="text-white font-medium">{unlockedCount}/{totalSlots}</span>
                </div>

                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-cyan-400 to-indigo-500"
                    style={{ width: `${(unlockedCount / totalSlots) * 100}%` }}
                  />
                </div>

                {nextTier ? (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Prochain palier: {nextTier.threshold} pts
                  </p>
                ) : (
                  <p className="text-xs text-emerald-300">Tous les paliers sont débloqués.</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
