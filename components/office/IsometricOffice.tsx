"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AgentDeskSpot } from "@/components/office/AgentDeskSpot";
import { DeptIcon } from "@/components/ui/DeptIcon";
import { Loader2, ImageOff, RefreshCw } from "lucide-react";

interface Agent {
  slug: string;
  name: string;
  role: string;
  department: string;
  mood?: string | null;
  icon_url?: string | null;
}

// Desk positions as percentage of the container (x%, y%)
// Calibrated for a wide isometric studio layout — adjust after seeing the generated bg
const DESK_POSITIONS: { x: number; y: number }[] = [
  { x: 14, y: 36 }, // Art
  { x: 28, y: 26 }, // Programming
  { x: 48, y: 21 }, // Game Design
  { x: 64, y: 30 }, // Audio
  { x: 76, y: 48 }, // Narrative
  { x: 42, y: 54 }, // QA
  { x: 20, y: 60 }, // Marketing
  { x: 84, y: 16 }, // Direction / Production
];

const BG_URL_KEY = "office_bg_url";

export function IsometricOffice() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load agents
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  // Load saved bg URL from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(BG_URL_KEY);
    if (saved) setBgUrl(saved);
  }, []);

  async function generateBackground() {
    setGenerating(true);
    setBgError(false);
    try {
      const res = await fetch("/api/ai/generate-office-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: "background" }),
      });
      const data = await res.json();
      if (data.url) {
        setBgUrl(data.url);
        localStorage.setItem(BG_URL_KEY, data.url);
      } else {
        setBgError(true);
      }
    } catch {
      setBgError(true);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
      style={{ aspectRatio: "16/9" }}
    >
      {/* Background image */}
      {bgUrl && !bgError ? (
        <>
          <Image
            src={bgUrl}
            alt="Studio bureau"
            fill
            unoptimized
            className="object-cover"
            onLoad={() => setBgLoading(false)}
            onError={() => setBgError(true)}
          />
          {/* Vignette overlay for depth */}
          <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent via-transparent to-black/40 pointer-events-none" />
        </>
      ) : (
        /* Placeholder while no image */
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center gap-4">
          {generating ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Génération du bureau en cours…</p>
            </>
          ) : (
            <>
              <ImageOff className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">Aucun fond généré</p>
              <button
                onClick={generateBackground}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <RefreshCw className="w-4 h-4" />
                Générer le bureau
              </button>
            </>
          )}
        </div>
      )}

      {/* Regenerate button (top-right, visible only when bg exists) */}
      {bgUrl && !bgError && (
        <button
          onClick={generateBackground}
          disabled={generating}
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur text-xs text-white/60 hover:text-white hover:bg-black/70 border border-white/10 transition-all"
          title="Régénérer le fond"
        >
          <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Génération…" : "Régénérer"}
        </button>
      )}

      {/* Agent desk spots */}
      {agents.map((agent, index) => {
        const pos = DESK_POSITIONS[index % DESK_POSITIONS.length];
        return (
          <div
            key={agent.slug}
            className="absolute z-10"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <AgentDeskSpot
              slug={agent.slug}
              name={agent.name}
              role={agent.role}
              department={agent.department}
              mood={agent.mood}
              iconUrl={agent.icon_url}
            />
          </div>
        );
      })}

      {/* Department legend bar */}
      {agents.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap gap-2">
          {agents.map((agent) => (
            <div
              key={agent.slug}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur border border-white/10 text-xs text-white/60"
            >
              <DeptIcon department={agent.department} size={10} />
              <span>{agent.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      )}

      {bgLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-30">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}
    </div>
  );
}
