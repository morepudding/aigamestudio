"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { LpcAutoWalker } from "@/components/office/LpcWalker";
import type { ZoneBounds } from "@/components/office/LpcWalker";
import { DeptIcon } from "@/components/ui/DeptIcon";
import { Loader2, ImageOff, RefreshCw, Sparkles, Crosshair, X } from "lucide-react";
import { useChatPanel } from "@/components/chat/ChatPanelProvider";

interface Agent {
  slug: string;
  name: string;
  role: string;
  department: string;
  mood?: string | null;
  icon_url?: string | null;
  lpc_sprite_url?: string | null;
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
const ZONE_KEY = "office_walk_zone";

type DrawRect = { x: number; y: number; w: number; h: number };

export function IsometricOffice() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSprites, setGeneratingSprites] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 450 });
  const { openChat } = useChatPanel();

  // Zone restriction
  const [zone, setZone] = useState<ZoneBounds | null>(null);
  const [editingZone, setEditingZone] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);

  // Track container dimensions for LpcAutoWalker positioning
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Load agents
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  // Load background from PixelArtOffice saved layout (studio-config), fallback to localStorage
  useEffect(() => {
    const savedZone = localStorage.getItem(ZONE_KEY);
    if (savedZone) {
      try { setZone(JSON.parse(savedZone)); } catch { /* ignore */ }
    }
    // Primary: use the studioAssetUrl from the saved PixelArtOffice layout
    fetch("/api/office/studio-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const url: string | null = data?.layout?.studioAssetUrl ?? null;
        if (url) {
          setBgUrl(url);
        } else {
          // Fallback to locally stored URL
          const saved = localStorage.getItem(BG_URL_KEY);
          if (saved) setBgUrl(saved);
        }
      })
      .catch(() => {
        const saved = localStorage.getItem(BG_URL_KEY);
        if (saved) setBgUrl(saved);
      });
  }, []);

  // ── Zone drawing ──────────────────────────────────────────────────────────
  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editingZone) return;
    e.preventDefault();
    const pos = getRelativePos(e);
    setDrawStart(pos);
    setDrawRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }, [editingZone, getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!editingZone || !drawStart) return;
    const pos = getRelativePos(e);
    setDrawRect({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    });
  }, [editingZone, drawStart, getRelativePos]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!editingZone || !drawStart || !drawRect) return;
    const { w: cw, h: ch } = containerSize;
    if (drawRect.w > 10 && drawRect.h > 10) {
      const newZone: ZoneBounds = {
        x1: drawRect.x / cw,
        y1: drawRect.y / ch,
        x2: (drawRect.x + drawRect.w) / cw,
        y2: (drawRect.y + drawRect.h) / ch,
      };
      setZone(newZone);
      localStorage.setItem(ZONE_KEY, JSON.stringify(newZone));
    }
    setDrawStart(null);
    setDrawRect(null);
    setEditingZone(false);
  }, [editingZone, drawStart, drawRect, containerSize]);

  function clearZone() {
    setZone(null);
    localStorage.removeItem(ZONE_KEY);
  }

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

  async function generateAllSprites() {
    setGeneratingSprites(true);
    const missing = agents.filter((a) => !a.lpc_sprite_url);
    await Promise.all(
      missing.map((a) =>
        fetch(`/api/agents/${a.slug}/generate-sprite`, { method: "POST" })
          .then((r) => r.json())
          .then((data) => {
            if (data.sprite_url) {
              setAgents((prev) =>
                prev.map((ag) =>
                  ag.slug === a.slug ? { ...ag, lpc_sprite_url: data.sprite_url } : ag
                )
              );
            }
          })
          .catch(() => {})
      )
    );
    setGeneratingSprites(false);
  }

  const hasMissingSprites = agents.some((a) => !a.lpc_sprite_url);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl${editingZone ? " cursor-crosshair" : ""}`}
      style={{ aspectRatio: "16/9" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
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
        <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center gap-4">
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

      {/* Top-right toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {/* Zone controls */}
        {zone && !editingZone && (
          <button
            onClick={clearZone}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/70 backdrop-blur text-xs text-white hover:bg-red-500 border border-red-400/40 transition-all"
            title="Supprimer la zone de déplacement"
          >
            <X className="w-3 h-3" />
            Zone
          </button>
        )}
        <button
          onClick={() => { setEditingZone((v) => !v); setDrawStart(null); setDrawRect(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur text-xs border transition-all ${
            editingZone
              ? "bg-amber-400/80 text-black border-amber-300/60 hover:bg-amber-400"
              : "bg-black/50 text-white/60 hover:text-white hover:bg-black/70 border-white/10"
          }`}
          title={editingZone ? "Annuler le dessin" : "Définir une zone de déplacement"}
        >
          <Crosshair className="w-3 h-3" />
          {editingZone ? "Dessinez…" : "Zone"}
        </button>
        {hasMissingSprites && (
          <button
            onClick={generateAllSprites}
            disabled={generatingSprites}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/80 backdrop-blur text-xs text-white hover:bg-primary border border-primary/40 transition-all"
            title="Générer les sprites pixel pour tous les agents"
          >
            {generatingSprites ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {generatingSprites ? "Sprites…" : "Sprites pixel"}
          </button>
        )}
        {bgUrl && !bgError && (
          <button
            onClick={generateBackground}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur text-xs text-white/60 hover:text-white hover:bg-black/70 border border-white/10 transition-all"
            title="Régénérer le fond"
          >
            <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Génération…" : "Régénérer"}
          </button>
        )}
      </div>

      {/* Zone overlay — existing saved zone */}
      {zone && (
        <div
          className="absolute pointer-events-none border-2 border-amber-400/70 bg-amber-400/10 z-10"
          style={{
            left: `${zone.x1 * 100}%`,
            top: `${zone.y1 * 100}%`,
            width: `${(zone.x2 - zone.x1) * 100}%`,
            height: `${(zone.y2 - zone.y1) * 100}%`,
          }}
        >
          <span className="absolute top-1 left-1 text-[10px] text-amber-300/80 bg-black/40 px-1 rounded leading-tight">
            zone
          </span>
        </div>
      )}

      {/* Zone drawing preview */}
      {drawRect && drawRect.w > 2 && drawRect.h > 2 && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-amber-300 bg-amber-300/10 z-20"
          style={{
            left: drawRect.x,
            top: drawRect.y,
            width: drawRect.w,
            height: drawRect.h,
          }}
        />
      )}

      {/* LPC walking sprites (agents that have a sprite) */}
      {agents
        .filter((a) => a.lpc_sprite_url)
        .map((agent, i) => {
          const pos = DESK_POSITIONS[i % DESK_POSITIONS.length];
          return (
            <LpcAutoWalker
              key={agent.slug}
              spriteUrl={agent.lpc_sprite_url!}
              agentName={agent.name}
              onClick={editingZone ? undefined : () => openChat(agent.slug)}
              containerW={containerSize.w}
              containerH={containerSize.h}
              initialX={pos.x / 100}
              initialY={pos.y / 100}
              zoneBounds={zone ?? undefined}
            />
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
