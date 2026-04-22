"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useMemo } from "react";
import { Stage, Layer, Image as KImage, Rect, Text } from "react-konva";
import { useChatPanel } from "@/components/chat/ChatPanelProvider";
import { LpcAutoWalker, type AgentZone } from "@/components/office/LpcWalker";
import { ZoneDrawingTool } from "@/components/office/ZoneDrawingTool";
import { ZoneOverlay } from "@/components/office/ZoneOverlay";
import { ZoneService } from "@/lib/services/zoneService";
import type { OfficeZone, ZoneBoundsData } from "@/lib/types/office";
import { getAllAvailableLpcHairStyles } from "@/lib/config/lpcMapping";
import { appearanceOptions, hairColors } from "@/lib/wizard-data";
import {
  Check,
  Copy,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  Monitor,
  Leaf,
  Armchair,
  Archive,
  Coffee,
  Droplets,
  Sparkles,
  X,
  Menu,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Map,
} from "lucide-react";
import { useOfficeNav } from "@/components/sidebar";
import {
  generateAndLoadAssetWithUrl,
  fetchAssetVariants,
  fetchOrGenerateVariant,
  loadImage,
  type OfficeAssetType,
  type AssetVariant,
  VARIANT_LABELS,
} from "@/lib/services/officeAssetService";

const FALLBACK_CANVAS_W = 1280;
const FALLBACK_CANVAS_H = 720;
const MAX_ACTIVE_AGENTS = 4;
const AGENT_ROTATION_INTERVAL_MS = 8000;

type PlaceableOfficeAssetType = Exclude<
  OfficeAssetType,
  "studio_empty" | "wall_poster" | "wall_shelf" | "wall_neon_sign" | "desk_lamp" | "floor_lamp" | "neon_light"
>;

const ASSET_LABELS: Record<OfficeAssetType, string> = {
  studio_empty: "Studio",
  desk_workstation: "Bureau PC",
  chair_office: "Chaise",
  plant_green_1: "Plante verte I",
  plant_green_2: "Plante verte II",
  plant_green_3: "Plante verte III",
  cabinet_storage: "Armoire",
  trash_can: "Poubelle",
  water_fountain: "Fontaine a eau",
  coffee_machine: "Machine a cafe",
  wall_poster: "Poster mural",
  wall_shelf: "Etagere murale",
  wall_neon_sign: "Neon mural",
  desk_lamp: "Lampe de bureau",
  floor_lamp: "Lampadaire",
  neon_light: "Lumiere neon",
};

const ASSET_PLACEMENT: Record<PlaceableOfficeAssetType, { idPrefix: string; baseSize: number }> = {
  desk_workstation: { idPrefix: "desk", baseSize: 300 },
  chair_office: { idPrefix: "chair", baseSize: 170 },
  plant_green_1: { idPrefix: "plant-1", baseSize: 170 },
  plant_green_2: { idPrefix: "plant-2", baseSize: 170 },
  plant_green_3: { idPrefix: "plant-3", baseSize: 170 },
  cabinet_storage: { idPrefix: "cabinet", baseSize: 230 },
  trash_can: { idPrefix: "trash", baseSize: 130 },
  water_fountain: { idPrefix: "water", baseSize: 210 },
  coffee_machine: { idPrefix: "coffee", baseSize: 170 },
};

type OfficeAssetInstance = {
  id: string;
  type: OfficeAssetType;
  sourceUrl: string;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  variant: AssetVariant;
};

type StudioLayoutPayload = {
  canvas: { width: number; height: number };
  studioAssetUrl: string;
  officeAgentScale?: number;
  assets: Array<{
    id?: string;
    type: OfficeAssetType;
    sourceUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    variant?: AssetVariant;
  }>;
};

type AssetVariantsMap = Partial<Record<OfficeAssetType, Partial<Record<AssetVariant, string>>>>;

type Agent = {
  slug: string;
  name: string;
  role: string;
  department: string;
  gender: string;
  lpc_sprite_url?: string | null;
  lpc_hair_style?: string | null;
  lpc_hair_color?: string | null;
};

type StudioConfigResponse = {
  layout?: StudioLayoutPayload | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const DESK_POSITIONS: { x: number; y: number }[] = [
  { x: 14, y: 36 },
  { x: 28, y: 26 },
  { x: 48, y: 21 },
  { x: 64, y: 30 },
  { x: 76, y: 48 },
  { x: 42, y: 54 },
  { x: 20, y: 60 },
  { x: 84, y: 16 },
];

// ─── Catalogue data ───────────────────────────────────────────────────────────

type CatalogCategory = {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: PlaceableOfficeAssetType[];
  description?: string;
};

const CATALOG_CATEGORIES: CatalogCategory[] = [
  {
    id: "mobilier",
    label: "Mobilier",
    icon: <Armchair className="w-3.5 h-3.5" />,
    description: "Module pilote valide",
    items: ["desk_workstation"],
  },
  {
    id: "social",
    label: "Coin cafe compact",
    icon: <Coffee className="w-3.5 h-3.5" />,
    description: "Module prioritaire 2",
    items: ["coffee_machine", "water_fountain"],
  },
  {
    id: "vegetal",
    label: "Plante decorative",
    icon: <Leaf className="w-3.5 h-3.5" />,
    description: "Module prioritaire 3",
    items: ["plant_green_1", "plant_green_2", "plant_green_3"],
  },
  {
    id: "rangement",
    label: "Rangement ou etagere",
    icon: <Archive className="w-3.5 h-3.5" />,
    description: "Module prioritaire 4",
    items: ["cabinet_storage"],
  },
];

const ITEM_ICONS: Record<PlaceableOfficeAssetType, React.ReactNode> = {
  desk_workstation: <Monitor className="w-6 h-6" />,
  chair_office: <Armchair className="w-6 h-6" />,
  cabinet_storage: <Archive className="w-6 h-6" />,
  plant_green_1: <Leaf className="w-6 h-6" />,
  plant_green_2: <Leaf className="w-6 h-6" />,
  plant_green_3: <Leaf className="w-6 h-6" />,
  trash_can: <Trash2 className="w-6 h-6" />,
  water_fountain: <Droplets className="w-6 h-6" />,
  coffee_machine: <Coffee className="w-6 h-6" />,
};

// ─── CatalogItem — one tile in the grid ──────────────────────────────────────
function CatalogItem({
  type,
  variants,
  isGenerating,
  onClick,
}: {
  type: PlaceableOfficeAssetType;
  variants: Partial<Record<AssetVariant, string>>;
  isGenerating: boolean;
  onClick: () => void;
}) {
  // Show first available variant as preview
  const previewUrl = variants[1] ?? variants[2] ?? variants[3] ?? variants[4];
  const hasAny = !!previewUrl;

  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      title={ASSET_LABELS[type]}
      className="group relative aspect-square rounded-xl border border-white/10 bg-white/3 hover:bg-white/8 hover:border-indigo-400/40 transition-all overflow-hidden disabled:opacity-60"
    >
      {isGenerating ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        </div>
      ) : hasAny ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={ASSET_LABELS[type]}
          className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/20 group-hover:text-white/40 transition-colors">
          {ITEM_ICONS[type]}
        </div>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[9px] text-white/70 text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
        {ASSET_LABELS[type]}
      </div>
    </button>
  );
}
// ── SelectedAgentPanel — shown below canvas when agent is selected ───────────
function SelectedAgentPanel({
  agent,
  hairOptions,
  hairColorOptions,
  hairSaving,
  onHairStyleChange,
  onHairColorChange,
  onClose,
}: {
  agent: Agent;
  hairOptions: { value: string; label: string }[];
  hairColorOptions: { value: string; label: string; color: string }[];
  hairSaving: boolean;
  onHairStyleChange: (hairStyle: string) => void;
  onHairColorChange: (hairColor: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/70">{agent.name}</span>
          <span className="text-[10px] text-white/30">{agent.role}</span>
          <span className="text-[10px] text-white/30">{agent.department}</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-3 border-t border-white/8 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-white/55 uppercase tracking-wider">Coupe du sprite</span>
          {hairSaving && (
            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-200/80">
              <Loader2 className="w-3 h-3 animate-spin" />
              Mise à jour...
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hairOptions.map((option) => {
            const isActive = (agent.lpc_hair_style ?? "none") === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onHairStyleChange(option.value)}
                disabled={hairSaving || isActive}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  isActive
                    ? "bg-indigo-500/20 border border-indigo-400/40 text-indigo-100"
                    : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                } disabled:opacity-60 disabled:cursor-default`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="pt-1">
          <span className="text-[11px] font-medium text-white/55 uppercase tracking-wider">Couleur</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hairColorOptions.map((option) => {
              const isActive = (agent.lpc_hair_color ?? "") === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onHairColorChange(option.value)}
                  disabled={hairSaving || isActive}
                  title={option.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    isActive
                      ? "border-indigo-300 scale-110 shadow-lg shadow-indigo-500/20"
                      : "border-white/10 hover:scale-110"
                  } disabled:opacity-60 disabled:cursor-default`}
                  style={{ backgroundColor: option.color }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── SelectedAssetPanel — shown below canvas when asset is selected ───────────
function SelectedAssetPanel({
  asset,
  variants,
  isChangingAngle,
  onSize,
  onAngle,
  onDuplicate,
  onDelete,
  onClose,
}: {
  asset: OfficeAssetInstance;
  variants: Partial<Record<AssetVariant, string>>;
  isChangingAngle: boolean;
  onSize: (mult: number) => void;
  onAngle: (variant: AssetVariant, needsGeneration: boolean, force?: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirmVariant, setConfirmVariant] = useState<{ variant: AssetVariant; regen: boolean } | null>(null);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/70">{ASSET_LABELS[asset.type]}</span>
          <span className="text-[10px] text-white/30">{asset.width} × {asset.height}px</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Confirm generation / regen */}
      {confirmVariant !== null && (
        <div className="px-3 py-2 border-b border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-amber-300/80">
            {confirmVariant.regen
              ? `Régénérer l'angle ${VARIANT_LABELS[confirmVariant.variant]} ?`
              : `Générer l'angle ${VARIANT_LABELS[confirmVariant.variant]} ?`
            }
            <span className="ml-1 text-amber-400/50">(1 génération IA)</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { onAngle(confirmVariant.variant, true, confirmVariant.regen); setConfirmVariant(null); }}
              className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[11px] font-semibold hover:bg-amber-500/30 transition-all"
            >
              {confirmVariant.regen ? "Régénérer" : "Générer"}
            </button>
            <button
              onClick={() => setConfirmVariant(null)}
              className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 text-[11px] hover:text-white/70 transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="px-3 py-2 flex items-center gap-3">
        {/* Size */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSize(0.85)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Réduire"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSize(1.15)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Agrandir"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Angle selector — all 4 angles, dimmed if not generated */}
        <div className="flex items-center gap-1 border-l border-white/8 pl-3">
          {isChangingAngle ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
          ) : (
            ([1, 2, 3, 4] as AssetVariant[]).map((v) => {
              const hasVariant = !!variants[v];
              const isActive = asset.variant === v;
              return (
                <button
                  key={v}
                  onClick={() => {
                    if (hasVariant && !isActive) { onAngle(v, false); }
                    else if (!hasVariant) { setConfirmVariant({ variant: v, regen: false }); }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (hasVariant) setConfirmVariant({ variant: v, regen: true });
                  }}
                  title={hasVariant ? `Vue ${VARIANT_LABELS[v]} — clic droit pour régénérer` : `Générer vue ${VARIANT_LABELS[v]}`}
                  className={[
                    "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all",
                    isActive
                      ? "bg-indigo-500/40 text-indigo-100 border border-indigo-400/50"
                      : hasVariant
                      ? "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                      : "border border-dashed border-white/15 text-white/20 hover:border-amber-400/40 hover:text-amber-300/60",
                  ].join(" ")}
                >
                  {VARIANT_LABELS[v]}
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 border-l border-white/8 pl-3 ml-auto">
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Dupliquer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/70 hover:text-red-300 hover:bg-red-500/20 transition-all"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PixelArtOffice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: FALLBACK_CANVAS_W, height: FALLBACK_CANVAS_H });
  const [canvasScale, setCanvasScale] = useState(1);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const officeNav = useOfficeNav();
  const { openChat } = useChatPanel();

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [generatingType, setGeneratingType] = useState<OfficeAssetType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [generatingSprites, setGeneratingSprites] = useState(false);
  const [generatingAllAssets, setGeneratingAllAssets] = useState(false);
  const [assetProgress, setAssetProgress] = useState("");

  const [studioImage, setStudioImage] = useState<HTMLImageElement | null>(null);
  const [studioAssetUrl, setStudioAssetUrl] = useState<string | null>(null);
  const [assetVariants, setAssetVariants] = useState<AssetVariantsMap>({});

  const [assets, setAssets] = useState<OfficeAssetInstance[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [changingAngleFor, setChangingAngleFor] = useState<string | null>(null);
  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(null);
  const [officeAgentScale, setOfficeAgentScale] = useState(1);
  const [activeAgentOffset, setActiveAgentOffset] = useState(0);
  const [savingAgentHairSlug, setSavingAgentHairSlug] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>("mobilier");

  // Zone states
  const [zones, setZones] = useState<OfficeZone[]>([]);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [showZonesOverlay, setShowZonesOverlay] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [pendingZoneBounds, setPendingZoneBounds] = useState<ZoneBoundsData | null>(null);
  const [isSavingZone, setIsSavingZone] = useState(false);

  useEffect(() => {
    void initializeStudio().catch((error) => {
      console.error("[PixelArtOffice] initializeStudio failed:", error);
      setStatus("error");
      setErrorMessage(getErrorMessage(error, "Impossible d'initialiser le studio."));
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => response.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]));
  }, []);

  // Load zones
  useEffect(() => {
    const loadZones = async () => {
      try {
        const fetchedZones = await ZoneService.getAllZones();
        setZones(fetchedZones);
      } catch (err) {
        console.error("Error loading zones:", err);
      }
    };
    
    loadZones();
  }, []);

  const [containerSize, setContainerSize] = useState({ width: FALLBACK_CANVAS_W, height: FALLBACK_CANVAS_H });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      setContainerSize({ width: containerW, height: containerH });
      const scaleW = containerW / canvasSize.width;
      const scaleH = containerH / canvasSize.height;
      setCanvasScale(Math.min(scaleW, scaleH));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [canvasSize.width, canvasSize.height]);

  const stageW = containerSize.width;
  const stageH = containerSize.height;
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const hasMissingSprites = agents.some((agent) => !agent.lpc_sprite_url);
  const agentsWithSprites = useMemo(() => agents.filter((agent) => agent.lpc_sprite_url), [agents]);
  const activeAgents = useMemo(() => {
    if (agentsWithSprites.length <= MAX_ACTIVE_AGENTS) {
      return agentsWithSprites;
    }

    return Array.from({ length: MAX_ACTIVE_AGENTS }, (_, index) => {
      const agentIndex = (activeAgentOffset + index) % agentsWithSprites.length;
      return agentsWithSprites[agentIndex];
    });
  }, [activeAgentOffset, agentsWithSprites]);

  useEffect(() => {
    if (agentsWithSprites.length <= MAX_ACTIVE_AGENTS) {
      setActiveAgentOffset(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveAgentOffset((current) => (current + 1) % agentsWithSprites.length);
    }, AGENT_ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [agentsWithSprites]);

  const displayZones = useMemo<OfficeZone[]>(() => {
    if (!pendingZoneBounds) {
      return zones;
    }

    return [
      ...zones,
      {
        id: "pending-zone",
        name: "Nouvelle zone",
        description: "Zone en attente de confirmation",
        bounds: pendingZoneBounds,
        color: "#3b82f6",
        opacity: 0.24,
        zone_type: "common",
        department: null,
        agent_slug: null,
        is_active: true,
        is_exclusive: true,
        allow_crossing: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }, [pendingZoneBounds, zones]);

  const generateAllAssets = async () => {
    setGeneratingAllAssets(true);
    const total = PLACEABLE_ASSET_TYPES.length;
    for (let i = 0; i < total; i++) {
      const asset = PLACEABLE_ASSET_TYPES[i];
      setAssetProgress(`${ASSET_LABELS[asset]} NO (${i + 1}/${total})`);
      const r1 = await fetch("/api/ai/generate-office-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, variant: 1, force: true }),
      });
      const d1 = await r1.json();
      if (d1.url) persistVariant(asset, 1, d1.url);

      for (const variant of [2, 3, 4] as const) {
        setAssetProgress(`${ASSET_LABELS[asset]} ${VARIANT_LABELS[variant]} (${i + 1}/${total})`);
        const r = await fetch("/api/ai/generate-office-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, variant, force: true, use_v1_init: true }),
        });
        const d = await r.json();
        if (d.url) persistVariant(asset, variant, d.url);
      }
    }
    setGeneratingAllAssets(false);
    setAssetProgress("");
  };

  const syncAllAssets = async (showFeedback = true) => {
    if (showFeedback) {
      setAssetProgress("Sync…");
      setGeneratingAllAssets(true);
    }

    await Promise.all(
      PLACEABLE_ASSET_TYPES.map(async (asset) => {
        const data = await fetchAssetVariants(asset);
        for (const v of [1, 2, 3, 4] as AssetVariant[]) {
          const url = data[v];
          if (url) persistVariant(asset, v, url);
        }
      })
    );

    if (showFeedback) {
      setGeneratingAllAssets(false);
      setAssetProgress("");
    }
  };

  const generateAllSprites = async () => {
    setGeneratingSprites(true);
    const missingAgents = agents.filter((agent) => !agent.lpc_sprite_url);

    await Promise.all(
      missingAgents.map((agent) =>
        fetch(`/api/agents/${agent.slug}/generate-sprite`, { method: "POST" })
          .then((response) => response.json())
          .then((data) => {
            if (!data.sprite_url) return;
            setAgents((current) => current.map((entry) => (
              entry.slug === agent.slug
                ? { ...entry, lpc_sprite_url: data.sprite_url }
                : entry
            )));
          })
          .catch(() => undefined)
      )
    );

    setGeneratingSprites(false);
  };

  // ── Zone management functions ──────────────────────────────────────────────
  const confirmPendingZone = async () => {
    if (!pendingZoneBounds) {
      return;
    }

    setIsSavingZone(true);
    setErrorMessage(null);

    const savedZone = await ZoneService.createZone({
      name: "Zone de circulation",
      description: "Zone libre de déplacement",
      bounds: pendingZoneBounds,
      zone_type: "common",
      color: "#3b82f6",
      opacity: 0.18,
      is_exclusive: true,
      allow_crossing: true,
    });

    if (!savedZone) {
      setIsSavingZone(false);
      setErrorMessage("Impossible d'enregistrer la zone.");
      setTimeout(() => setErrorMessage(null), 2500);
      return;
    }

    setZones([savedZone]);
    setSelectedZoneId(savedZone.id);
    setPendingZoneBounds(null);
    setIsSavingZone(false);
    setSaveMessage("Zone mise à jour");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleZoneDrawingComplete = (bounds: ZoneBoundsData) => {
    setIsDrawingZone(false);
    setPendingZoneBounds(bounds);
    setSelectedZoneId("pending-zone");
    setShowZonesOverlay(true);
    setSaveMessage(null);
    setErrorMessage(null);
  };

  const handleZoneDrawingCancel = () => {
    setIsDrawingZone(false);
    setPendingZoneBounds(null);
    setSelectedZoneId(null);
  };

  const handleZoneClick = (zone: OfficeZone) => {
    setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id);
  };

  const toggleZonesOverlay = () => {
    setShowZonesOverlay(prev => !prev);
  };

  const startDrawingZone = () => {
    setPendingZoneBounds(null);
    setIsDrawingZone(true);
    setSelectedAssetId(null);
    setSelectedAgentSlug(null);
    setSelectedZoneId(null);
    setErrorMessage(null);
  };

  const redrawPendingZone = () => {
    setPendingZoneBounds(null);
    setSelectedZoneId(null);
    setIsDrawingZone(true);
    setErrorMessage(null);
  };

  const discardPendingZone = () => {
    setPendingZoneBounds(null);
    setSelectedZoneId(null);
  };

  // Convert OfficeZone to AgentZone for LpcAutoWalker
  const getAgentZones = useMemo(() => {
    return (agentSlug: string, agentDepartment: string): AgentZone[] => {
      const agentSpecificZones = zones.filter(z => 
        z.is_active && (z.agent_slug === agentSlug || z.department === agentDepartment || (!z.agent_slug && !z.department))
      );

      return agentSpecificZones.map(zone => {
        // ZoneBoundsData est maintenant directement ZoneBounds
        const bounds = zone.bounds;

        return {
          id: zone.id,
          bounds,
          isExclusive: zone.is_exclusive,
          priority: zone.agent_slug === agentSlug ? 3 : 
                   zone.department === agentDepartment ? 2 : 1,
        };
      });
    };
  }, [zones]);

  // ── Persist variant URL ────────────────────────────────────────────────────
  const persistVariant = (assetType: OfficeAssetType, variant: AssetVariant, url: string) => {
    setAssetVariants((prev) => ({
      ...prev,
      [assetType]: { ...prev[assetType], [variant]: url },
    }));
  };

  // ── Restore layout ─────────────────────────────────────────────────────────
  const restoreLayout = async (layout: StudioLayoutPayload) => {
    const bg = await loadImage(layout.studioAssetUrl);
    if (!bg) throw new Error("Impossible de charger le fond sauvegardé.");
    const width = layout.canvas?.width || bg.naturalWidth || FALLBACK_CANVAS_W;
    const height = layout.canvas?.height || bg.naturalHeight || FALLBACK_CANVAS_H;
    const nextAgentScale = typeof layout.officeAgentScale === "number"
      ? Math.max(0.5, Math.min(3, layout.officeAgentScale))
      : 1;
    const restored = await Promise.all(
      (layout.assets ?? []).map(async (a, i) => {
        const image = await loadImage(a.sourceUrl);
        if (!image) return null;
        return {
          id: a.id ?? `${a.type}-${Date.now()}-${i}`,
          type: a.type,
          sourceUrl: a.sourceUrl,
          image,
          x: a.x, y: a.y,
          width: a.width, height: a.height,
          variant: (a.variant ?? 1) as AssetVariant,
        } satisfies OfficeAssetInstance;
      })
    );
    setStudioImage(bg);
    setStudioAssetUrl(layout.studioAssetUrl);
    setCanvasSize({ width, height });
    setOfficeAgentScale(nextAgentScale);
    setAssets(restored.filter((a): a is OfficeAssetInstance => !!a));
    setSelectedAssetId(null);
  };

  // ── Initialize ─────────────────────────────────────────────────────────────
  const initializeStudio = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/office/studio-config", { cache: "no-store" });
      const config = (await res.json()) as StudioConfigResponse;

      if (config.layout) {
        await restoreLayout(config.layout);
        void syncAllAssets(false);
        setStatus("ready");
        return;
      }

      await loadBackground(false);
      void syncAllAssets(false);
    } catch (error) {
      console.error("[PixelArtOffice] Falling back to generated studio:", error);

      try {
        await loadBackground(false);
        void syncAllAssets(false);
      } catch (fallbackError) {
        console.error("[PixelArtOffice] loadBackground fallback failed:", fallbackError);
        setStatus("error");
        setErrorMessage(getErrorMessage(fallbackError, "Impossible d'initialiser le studio."));
      }
    }
  };

  // ── Load/generate background ───────────────────────────────────────────────
  const loadBackground = async (force = false) => {
    setStatus("loading");
    setGeneratingType("studio_empty");

    if (!force) {
      const variants = await fetchAssetVariants("studio_empty");
      const url = variants[1];
      if (url) {
        const img = await loadImage(url);
        if (img) {
          setStudioImage(img);
          setStudioAssetUrl(url);
          setCanvasSize({ width: img.naturalWidth || FALLBACK_CANVAS_W, height: img.naturalHeight || FALLBACK_CANVAS_H });
          setStatus("ready");
          setGeneratingType(null);
          return;
        }
      }
    }

    const generated = await generateAndLoadAssetWithUrl("studio_empty", 1, force);
    setGeneratingType(null);
    if (!generated) { setStatus("error"); setErrorMessage("Impossible de générer le studio."); return; }
    setStudioImage(generated.image);
    setStudioAssetUrl(generated.url);
    setCanvasSize({ width: generated.image.naturalWidth || FALLBACK_CANVAS_W, height: generated.image.naturalHeight || FALLBACK_CANVAS_H });
    setStatus("ready");
  };

  // ── Place asset — called when user clicks a catalog item ───────────────────
  const handleCatalogClick = async (type: PlaceableOfficeAssetType) => {
    // Pick first available variant, default to 1
    const existingVariant = ([1, 2, 3, 4] as AssetVariant[]).find((v) => assetVariants[type]?.[v]);
    const variant: AssetVariant = existingVariant ?? 1;
    const existingUrl = assetVariants[type]?.[variant];

    if (existingUrl) {
      const img = await loadImage(existingUrl);
      if (img) { placeAsset(type, existingUrl, img, variant); return; }
    }

    // Generate on demand
    setGeneratingType(type);
    setErrorMessage(null);
    const url = await fetchOrGenerateVariant(type, 1, false);
    setGeneratingType(null);

    if (!url) { setErrorMessage(`Impossible de générer ${ASSET_LABELS[type]}.`); return; }
    persistVariant(type, 1, url);
    const img = await loadImage(url);
    if (img) placeAsset(type, url, img, 1);
  };

  // ── Place an asset instance on canvas ─────────────────────────────────────
  const placeAsset = (type: PlaceableOfficeAssetType, sourceUrl: string, image: HTMLImageElement, variant: AssetVariant) => {
    const { idPrefix, baseSize } = ASSET_PLACEMENT[type];
    const newAsset: OfficeAssetInstance = {
      id: `${idPrefix}-${Date.now()}`,
      type, sourceUrl, image, variant,
      x: Math.round(canvasSize.width / 2 - baseSize / 2),
      y: Math.round(canvasSize.height / 2 - baseSize / 2),
      width: baseSize, height: baseSize,
    };
    setAssets((prev) => [...prev, newAsset]);
    setSelectedAssetId(newAsset.id);
    setStatus("ready");
  };

  // ── Change angle of selected asset ────────────────────────────────────────
  // needsGeneration=true only when user explicitly confirmed
  // needsGeneration: user confirmed a generate/regen — force=true for regen
  const changeAngle = async (assetId: string, type: PlaceableOfficeAssetType, variant: AssetVariant, needsGeneration: boolean, force = false) => {
    const existingUrl = assetVariants[type]?.[variant];

    if (existingUrl && !force) {
      const img = await loadImage(existingUrl);
      if (img) {
        setAssets((prev) => prev.map((a) =>
          a.id === assetId ? { ...a, sourceUrl: existingUrl, image: img, variant } : a
        ));
        return;
      }
    }

    if (!needsGeneration) return;

    setChangingAngleFor(assetId);
    const url = await fetchOrGenerateVariant(type, variant, force);
    setChangingAngleFor(null);
    if (!url) return;

    persistVariant(type, variant, url);
    const img = await loadImage(url);
    if (!img) return;
    setAssets((prev) => prev.map((a) =>
      a.id === assetId ? { ...a, sourceUrl: url, image: img, variant } : a
    ));
  };

  // ── Resize selected asset ──────────────────────────────────────────────────
  const resizeSelected = (mult: number) => {
    if (!selectedAssetId) return;
    setAssets((prev) => prev.map((a) => {
      if (a.id !== selectedAssetId) return a;
      return {
        ...a,
        width: Math.max(64, Math.min(1200, Math.round(a.width * mult))),
        height: Math.max(64, Math.min(1200, Math.round(a.height * mult))),
      };
    }));
  };

  // ── Resize all visible agents globally in the office ─────────────────────
  const resizeOfficeAgents = (mult: number) => {
    setOfficeAgentScale((current) => {
      if (mult === 1) {
        return 1;
      }

      return Math.max(0.5, Math.min(3.0, current * mult));
    });
  };

  const updateSelectedAgentHair = async (agent: Agent, updates: Partial<Pick<Agent, "lpc_hair_style" | "lpc_hair_color">>) => {
    if (savingAgentHairSlug === agent.slug) return;

    setSavingAgentHairSlug(agent.slug);
    setErrorMessage(null);

    try {
      const patchRes = await fetch(`/api/agents/${agent.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!patchRes.ok) {
        throw new Error("Échec de la mise à jour de la coupe.");
      }

      setAgents((current) => current.map((entry) => (
        entry.slug === agent.slug
          ? { ...entry, ...updates }
          : entry
      )));

      const spriteRes = await fetch(`/api/agents/${agent.slug}/generate-sprite`, { method: "POST" });
      const spriteData = await spriteRes.json();

      if (!spriteRes.ok || !spriteData.sprite_url) {
        throw new Error("Sprite non régénéré.");
      }

      setAgents((current) => current.map((entry) => (
        entry.slug === agent.slug
          ? {
              ...entry,
              ...updates,
              lpc_sprite_url: `${spriteData.sprite_url}?t=${Date.now()}`,
            }
          : entry
      )));

      setSaveMessage("Coupe mise à jour");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de modifier la coupe.");
      setTimeout(() => setErrorMessage(null), 2500);
    } finally {
      setSavingAgentHairSlug(null);
    }
  };

  // ── Duplicate / delete ─────────────────────────────────────────────────────
  const duplicateSelected = () => {
    if (!selectedAsset) return;
    const dup: OfficeAssetInstance = { ...selectedAsset, id: `asset-${Date.now()}`, x: selectedAsset.x + 24, y: selectedAsset.y + 24 };
    setAssets((prev) => [...prev, dup]);
    setSelectedAssetId(dup.id);
  };

  const deleteSelected = () => {
    if (!selectedAssetId) return;
    setAssets((prev) => prev.filter((a) => a.id !== selectedAssetId));
    setSelectedAssetId(null);
  };

  // ── Save layout ────────────────────────────────────────────────────────────
  const saveLayout = async () => {
    if (!studioAssetUrl) return;
    setSaveMessage("Sauvegarde...");
    const layout: StudioLayoutPayload = {
      canvas: { width: canvasSize.width, height: canvasSize.height },
      studioAssetUrl,
      officeAgentScale,
      assets: assets.map((a) => ({ id: a.id, type: a.type, sourceUrl: a.sourceUrl, x: a.x, y: a.y, width: a.width, height: a.height, variant: a.variant })),
    };
    try {
      const res = await fetch("/api/office/studio-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "layout", layout }) });
      if (!res.ok) throw new Error();
      setSaveMessage("Sauvegardé !");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage("Erreur sauvegarde");
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  // ── Restore layout ─────────────────────────────────────────────────────────
  const restoreFromDb = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/office/studio-config", { cache: "no-store" });
      const data = (await res.json()) as StudioConfigResponse;
      if (!data.layout) { setStatus("ready"); return; }
      await restoreLayout(data.layout);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  const activeCat = CATALOG_CATEGORIES.find((c) => c.id === activeCategory) ?? CATALOG_CATEGORIES[0];

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">

      {/* ── FULLSCREEN CANVAS ── */}
      <div ref={containerRef} className="absolute inset-0">
        {status === "loading" && !studioImage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="text-sm text-white/40">Génération en cours...</span>
          </div>
        )}

        <Stage
          width={stageW}
          height={stageH}
          scaleX={canvasScale}
          scaleY={canvasScale}
          onClick={(e) => { 
            if (e.target === e.target.getStage()) {
              setSelectedAssetId(null);
              setSelectedAgentSlug(null);
            }
          }}
        >
          <Layer>
            {/* Fond noir plein écran (bandes noires letterbox/pillarbox) */}
            <Rect x={0} y={0} width={stageW / canvasScale} height={stageH / canvasScale} fill="#0d0d14" />
            {studioImage && (() => {
              const imgW = studioImage.naturalWidth || canvasSize.width;
              const imgH = studioImage.naturalHeight || canvasSize.height;
              const availW = stageW / canvasScale;
              const availH = stageH / canvasScale;
              const scale = Math.min(availW / imgW, availH / imgH);
              const drawW = imgW * scale;
              const drawH = imgH * scale;
              const offsetX = (availW - drawW) / 2;
              const offsetY = (availH - drawH) / 2;
              return <KImage image={studioImage} x={offsetX} y={offsetY} width={drawW} height={drawH} />;
            })()}
            
            {/* Zone overlay */}
            {showZonesOverlay && displayZones.length > 0 && (
              <ZoneOverlay
                width={stageW / canvasScale}
                height={stageH / canvasScale}
                zones={displayZones}
                showLabels={true}
                showOnlyActive={true}
                selectedZoneId={selectedZoneId}
                onZoneClick={handleZoneClick}
              />
            )}
            
            {/* Zone drawing tool */}
            {isDrawingZone && (
              <ZoneDrawingTool
                width={stageW / canvasScale}
                height={stageH / canvasScale}
                isDrawing={isDrawingZone}
                onDrawingComplete={handleZoneDrawingComplete}
                onDrawingCancel={handleZoneDrawingCancel}
                existingZones={zones.map(z => z.bounds)}
              />
            )}
            {assets.map((asset) => {
              const isSelected = asset.id === selectedAssetId;
              return (
                <KImage
                  key={asset.id}
                  image={asset.image}
                  x={asset.x}
                  y={asset.y}
                  width={asset.width}
                  height={asset.height}
                  draggable
                  onClick={() => setSelectedAssetId(asset.id)}
                  onTap={() => setSelectedAssetId(asset.id)}
                  onDragEnd={(e) => {
                    const node = e.target;
                    setAssets((prev) => prev.map((a) =>
                      a.id === asset.id ? { ...a, x: node.x(), y: node.y() } : a
                    ));
                  }}
                  opacity={isSelected ? 1 : 0.95}
                  stroke={isSelected ? "#818cf8" : undefined}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            })}
          </Layer>
          <Layer listening={false}>
            <Text x={10} y={10} text={studioImage ? `${canvasSize.width} × ${canvasSize.height}` : ""} fontSize={11} fill="rgba(255,255,255,0.2)" />
          </Layer>
        </Stage>
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none">
        {activeAgents.map((agent, index) => {
            const pos = DESK_POSITIONS[index % DESK_POSITIONS.length];
            const isSelected = selectedAgentSlug === agent.slug;
            const agentZones = getAgentZones(agent.slug, agent.department);

            return (
              <LpcAutoWalker
                key={agent.slug}
                spriteUrl={agent.lpc_sprite_url!}
                agentName={agent.name}
                agentDepartment={agent.department}
                onClick={() => {
                  setSelectedAgentSlug(agent.slug);
                  setSelectedAssetId(null);
                  openChat(agent.slug);
                }}
                containerW={containerSize.width}
                containerH={containerSize.height}
                initialX={pos.x / 100}
                initialY={pos.y / 100}
                zones={agentZones}
                scale={officeAgentScale}
                selected={isSelected}
                className="pointer-events-auto"
              />
            );
          })}
      </div>

      {/* ── HUD: bouton nav (coin haut-gauche) ── */}
      <button
        onClick={officeNav.toggle}
        className="absolute top-3 left-3 z-30 p-2 rounded-xl bg-black/50 backdrop-blur border border-white/10 text-white/50 hover:text-white hover:bg-black/70 transition-all"
        title="Menu navigation"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* ── HUD: toolbar flottante (coin haut-droite) ── */}
      <div className="absolute top-3 right-3 z-30 flex flex-wrap items-start justify-end gap-2 max-w-[calc(100%-4rem)]">
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-black/55 backdrop-blur border border-white/10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 pr-1">
            Agents
          </span>
          <button
            onClick={() => resizeOfficeAgents(0.85)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Réduire globalement les agents"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="min-w-16 text-center text-[11px] text-white/70">
            Agents {(officeAgentScale * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => resizeOfficeAgents(1.15)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Agrandir globalement les agents"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => resizeOfficeAgents(1)}
            className="px-1.5 py-1 rounded-md text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-all"
            title="Taille normale"
          >
            100%
          </button>
        </div>

        <div className="px-2.5 py-1.5 rounded-xl bg-black/55 backdrop-blur border border-white/10 text-[11px] text-white/60">
          Actifs {Math.min(activeAgents.length, MAX_ACTIVE_AGENTS)}/{agentsWithSprites.length}
        </div>

        {/* Zone controls */}
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl bg-black/55 backdrop-blur border border-white/10">
          <button
            onClick={toggleZonesOverlay}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg backdrop-blur border text-[11px] transition-all ${
              showZonesOverlay
                ? 'bg-indigo-600/70 border-indigo-400/30 text-white hover:bg-indigo-500/70'
                : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:bg-black/70'
            }`}
            title={showZonesOverlay ? "Masquer les zones" : "Afficher les zones"}
          >
            {showZonesOverlay ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            Zones
          </button>
          
          <button
            onClick={startDrawingZone}
            disabled={isDrawingZone || isSavingZone}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg backdrop-blur border text-[11px] transition-all ${
              isDrawingZone
                ? 'bg-amber-600/70 border-amber-400/30 text-white'
                : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:bg-black/70'
            }`}
            title="Dessiner la zone de marche"
          >
            <Map className="w-3 h-3" />
            Zone
          </button>
        </div>

        {pendingZoneBounds && !isDrawingZone && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/12 backdrop-blur border border-amber-400/30">
            <span className="text-[11px] text-amber-100/90 pr-1">
              Zone tracée. Confirmez pour l&apos;enregistrer.
            </span>
            <button
              onClick={() => void confirmPendingZone()}
              disabled={isSavingZone}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600/80 border border-emerald-400/30 text-[11px] text-white hover:bg-emerald-500/80 transition-all disabled:opacity-50"
              title="Confirmer la zone"
            >
              {isSavingZone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Confirmer
            </button>
            <button
              onClick={redrawPendingZone}
              disabled={isSavingZone}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/40 border border-white/10 text-[11px] text-white/75 hover:text-white hover:bg-black/60 transition-all disabled:opacity-50"
              title="Redessiner"
            >
              <RotateCcw className="w-3 h-3" />
              Redessiner
            </button>
            <button
              onClick={discardPendingZone}
              disabled={isSavingZone}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/12 border border-red-400/20 text-[11px] text-red-200 hover:bg-red-500/20 transition-all disabled:opacity-50"
              title="Annuler la zone"
            >
              <X className="w-3 h-3" />
              Annuler
            </button>
          </div>
        )}
        
        {saveMessage && (
          <span className="text-[11px] text-emerald-400/80 flex items-center gap-1 px-2 py-1 rounded-xl bg-black/55 backdrop-blur border border-white/10">
            <Check className="w-3 h-3" /> {saveMessage}
          </span>
        )}
        {errorMessage && (
          <span className="text-[11px] text-red-400/80 px-2 py-1 rounded-xl bg-black/55 backdrop-blur border border-red-500/20">
            {errorMessage}
          </span>
        )}
        {hasMissingSprites && (
          <button
            onClick={() => void generateAllSprites()}
            disabled={generatingSprites}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/70 backdrop-blur border border-emerald-400/30 text-[11px] text-white hover:bg-emerald-500/70 transition-all disabled:opacity-30"
            title="Générer les sprites LPC des agents"
          >
            {generatingSprites ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Sprites
          </button>
        )}
        <button
          onClick={() => void syncAllAssets(true)}
          disabled={generatingAllAssets}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-600/70 backdrop-blur border border-sky-400/30 text-[11px] text-white hover:bg-sky-500/70 transition-all disabled:opacity-30"
          title="Sync — recharge les assets déjà générés depuis Supabase sans régénérer"
        >
          {generatingAllAssets && assetProgress === "Sync…" ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-[10px]">↻</span>}
          Sync
        </button>
        <Link
          href="/review-assets"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/70 backdrop-blur border border-emerald-400/30 text-[11px] text-white hover:bg-emerald-500/70 transition-all"
          title="Ouvrir la review dédiée raw vers approved/rejected"
        >
          Review
        </Link>
        <button
          onClick={() => void generateAllAssets()}
          disabled={generatingAllAssets}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-600/70 backdrop-blur border border-violet-400/30 text-[11px] text-white hover:bg-violet-500/70 transition-all disabled:opacity-30"
          title="Générer tous les assets NO (txt2img) puis NE/SE/SO (img2img)"
        >
          {generatingAllAssets && assetProgress !== "Sync…" ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-[10px]">⬡</span>}
          {generatingAllAssets && assetProgress !== "Sync…" ? assetProgress : "Assets"}
        </button>
        <button
          onClick={() => void loadBackground(true)}
          disabled={status === "loading"}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/55 backdrop-blur border border-white/10 text-[11px] text-white/40 hover:text-white/70 hover:bg-black/70 transition-all disabled:opacity-30"
          title="Nouveau fond"
        >
          {generatingType === "studio_empty" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Fond
        </button>
        <button
          onClick={restoreFromDb}
          disabled={status === "loading"}
          className="p-1.5 rounded-xl bg-black/55 backdrop-blur border border-white/10 text-white/30 hover:text-white/60 hover:bg-black/70 transition-all disabled:opacity-30"
          title="Restaurer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={saveLayout}
          disabled={!studioImage || status === "loading"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-[11px] font-semibold hover:bg-indigo-500/80 transition-all disabled:opacity-30"
        >
          <Save className="w-3.5 h-3.5" />
          Sauvegarder
        </button>
      </div>

      {/* ── HUD: catalogue d'assets (coin bas-gauche, collapsible) ── */}
      <div className="absolute bottom-4 left-3 z-30 w-56 flex flex-col gap-0 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden shadow-2xl">
        {/* Header / toggle */}
        <button
          onClick={() => setCatalogOpen((v) => !v)}
          className="flex items-center justify-between px-3 py-2 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
        >
          <span className="font-semibold uppercase tracking-wider">Modules</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white/25">{assets.length} actifs</span>
            {catalogOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </div>
        </button>

        {catalogOpen && (
          <>
            {/* Category tabs */}
            <div className="flex flex-col gap-0.5 px-2 pb-1 border-t border-white/8">
              {CATALOG_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={[
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left mt-1",
                    activeCategory === cat.id
                      ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5",
                  ].join(" ")}
                >
                  <span className="opacity-70">{cat.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{cat.label}</span>
                    {cat.description ? (
                      <span className="block text-[10px] text-white/30">{cat.description}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div className="p-2 border-t border-white/8">
              <div className="grid grid-cols-3 gap-1.5">
                {activeCat.items.map((type) => (
                  <CatalogItem
                    key={type}
                    type={type}
                    variants={assetVariants[type] ?? {}}
                    isGenerating={generatingType === type}
                    onClick={() => void handleCatalogClick(type)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── HUD: panel asset sélectionné (overlay bas, centré) ── */}
      {selectedAsset && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-3">
          <SelectedAssetPanel
            asset={selectedAsset}
            variants={assetVariants[selectedAsset.type] ?? {}}
            isChangingAngle={changingAngleFor === selectedAsset.id}
            onSize={resizeSelected}
            onAngle={(v, needsGeneration, force) => void changeAngle(selectedAsset.id, selectedAsset.type as PlaceableOfficeAssetType, v, needsGeneration, force)}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClose={() => setSelectedAssetId(null)}
          />
        </div>
      )}

      {/* ── HUD: panel agent sélectionné (overlay bas, centré) ── */}
      {selectedAgentSlug && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-3">
          {(() => {
            const agent = agents.find(a => a.slug === selectedAgentSlug);
            if (!agent) return null;
            const hairOptions = getAllAvailableLpcHairStyles(agent.gender);
            const colorSource = agent.gender === "femme" ? appearanceOptions.femme.cheveux : appearanceOptions.homme.cheveux;
            const hairColorOptions = colorSource.map((option) => ({
              value: option.value,
              label: option.label,
              color: hairColors[option.value] || "#666",
            }));
            return (
              <SelectedAgentPanel
                agent={agent}
                hairOptions={hairOptions}
                hairColorOptions={hairColorOptions}
                hairSaving={savingAgentHairSlug === agent.slug}
                onHairStyleChange={(hairStyle) => void updateSelectedAgentHair(agent, { lpc_hair_style: hairStyle })}
                onHairColorChange={(hairColor) => void updateSelectedAgentHair(agent, { lpc_hair_color: hairColor })}
                onClose={() => setSelectedAgentSlug(null)}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
