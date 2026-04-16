"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles, Lock, Loader2, RefreshCw } from "lucide-react";
import { EXCLUSIVE_PHOTO_TIERS } from "@/lib/config/exclusivePhotos";

interface AgentDetail {
  slug: string;
  name: string;
  role: string;
  confidence_level: number | null;
  portrait_url: string | null;
  icon_url: string | null;
}

const supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agent-avatars`
  : "";

function buildExclusiveUrl(slug: string, threshold: number, version: number) {
  if (!supabasePublicUrl) return null;
  return `${supabasePublicUrl}/${slug}/exclusive-${threshold}.png?v=${version}`;
}

export default function CollaborateurExclusiveGalleryPage() {
  const { slug } = useParams<{ slug: string }>();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageVersion, setImageVersion] = useState(() => Date.now());
  const [errorByTier, setErrorByTier] = useState<Record<number, string>>({});
  const [loadingByTier, setLoadingByTier] = useState<Record<number, boolean>>({});
  const [missingByTier, setMissingByTier] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setNotFound(false);

    fetch(`/api/agents/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        setAgent(data);
        setImageVersion(Date.now());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const confidence = agent?.confidence_level ?? 0;

  const unlockedThresholds = useMemo(
    () => new Set(EXCLUSIVE_PHOTO_TIERS.filter((tier) => confidence >= tier.threshold).map((tier) => tier.threshold)),
    [confidence]
  );

  const generateExclusive = async (threshold: number) => {
    if (!agent) return;

    setErrorByTier((prev) => ({ ...prev, [threshold]: "" }));
    setLoadingByTier((prev) => ({ ...prev, [threshold]: true }));

    try {
      const res = await fetch("/api/ai/generate-exclusive-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: agent.slug, threshold }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "La génération a échoué.");
      }

      setMissingByTier((prev) => ({ ...prev, [threshold]: false }));
      setImageVersion(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : "La génération a échoué.";
      setErrorByTier((prev) => ({ ...prev, [threshold]: message }));
    } finally {
      setLoadingByTier((prev) => ({ ...prev, [threshold]: false }));
    }
  };

  if (loading) {
    return <div className="text-muted-foreground animate-pulse">Chargement de la galerie…</div>;
  }

  if (notFound || !agent) {
    return (
      <div className="space-y-4">
        <Link
          href="/collaborateur"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <p className="text-muted-foreground">Collaborateur introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-3">
        <Link
          href={`/collaborateur/${agent.slug}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au profil
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Galerie de {agent.name}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Débloque et génère des photos exclusives en fonction de tes points de confiance.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white">
              <Sparkles className="w-4 h-4 text-amber-300" />
              {confidence} points de confiance
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {EXCLUSIVE_PHOTO_TIERS.map((tier) => {
          const unlocked = unlockedThresholds.has(tier.threshold);
          const generating = !!loadingByTier[tier.threshold];
          const tierError = errorByTier[tier.threshold];
          const imgSrc = buildExclusiveUrl(agent.slug, tier.threshold, imageVersion);
          const showImage = unlocked && imgSrc && !missingByTier[tier.threshold];

          return (
            <div
              key={tier.threshold}
              className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
            >
              <div className="p-4 border-b border-white/10 space-y-1">
                <p className="text-sm text-primary font-medium">Palier {tier.threshold} pts</p>
                <h2 className="text-lg font-semibold text-white">{tier.title}</h2>
                <p className="text-xs text-muted-foreground">{tier.subtitle}</p>
              </div>

              <div className="p-4 space-y-4">
                {showImage ? (
                  <div className="aspect-4/5 rounded-xl overflow-hidden border border-white/10 bg-black/30">
                    <Image
                      src={imgSrc}
                      alt={`${tier.title} de ${agent.name}`}
                      width={480}
                      height={600}
                      unoptimized
                      className="w-full h-full object-cover"
                      onError={() => setMissingByTier((prev) => ({ ...prev, [tier.threshold]: true }))}
                    />
                  </div>
                ) : (
                  <div className="aspect-4/5 rounded-xl border border-dashed border-white/20 bg-black/20 flex items-center justify-center p-4 text-center">
                    {unlocked ? (
                      <p className="text-sm text-muted-foreground">Photo non générée pour ce palier.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                        <Lock className="w-4 h-4" />
                        Verrouillé jusqu&apos;à {tier.threshold} pts
                      </p>
                    )}
                  </div>
                )}

                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => generateExclusive(tier.threshold)}
                    disabled={generating}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Génération…
                      </>
                    ) : showImage ? (
                      <>
                        <RefreshCw className="w-4 h-4" /> Régénérer la photo
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Générer la photo exclusive
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-muted-foreground text-center">
                    Il te manque {Math.max(0, tier.threshold - confidence)} points pour ce palier.
                  </div>
                )}

                {tierError ? (
                  <p className="text-sm text-rose-400">{tierError}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
