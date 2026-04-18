"use client";

import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Image as KImage, Rect, Text } from "react-konva";
import {
  Check,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Star,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
  Monitor,
  Leaf,
  ChevronDown,
  ChevronUp,
  Armchair,
  Archive,
  Coffee,
  Droplets,
  Layers,
  Package,
  Sparkles,
  X,
} from "lucide-react";
import {
  generateAndLoadAssetWithUrl,
  loadImage,
  type OfficeAssetType,
} from "@/lib/services/officeAssetService";

const FALLBACK_CANVAS_W = 1280;
const FALLBACK_CANVAS_H = 720;
const DEFAULT_ASSET_SIZE = 220;

type PlaceableOfficeAssetType = Exclude<OfficeAssetType, "studio_empty">;

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
};

const ASSET_PLACEMENT: Record<PlaceableOfficeAssetType, { idPrefix: string; baseSize: number; errorMessage: string }> = {
  desk_workstation: { idPrefix: "desk", baseSize: 300, errorMessage: "Impossible de generer le bureau." },
  chair_office: { idPrefix: "chair", baseSize: 170, errorMessage: "Impossible de generer la chaise." },
  plant_green_1: { idPrefix: "plant-1", baseSize: 170, errorMessage: "Impossible de generer la plante verte I." },
  plant_green_2: { idPrefix: "plant-2", baseSize: 170, errorMessage: "Impossible de generer la plante verte II." },
  plant_green_3: { idPrefix: "plant-3", baseSize: 170, errorMessage: "Impossible de generer la plante verte III." },
  cabinet_storage: { idPrefix: "cabinet", baseSize: 230, errorMessage: "Impossible de generer l'armoire." },
  trash_can: { idPrefix: "trash", baseSize: 130, errorMessage: "Impossible de generer la poubelle." },
  water_fountain: { idPrefix: "water", baseSize: 210, errorMessage: "Impossible de generer la fontaine a eau." },
  coffee_machine: { idPrefix: "coffee", baseSize: 170, errorMessage: "Impossible de generer la machine a cafe." },
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
};

type StudioLayoutPayload = {
  canvas: {
    width: number;
    height: number;
  };
  studioAssetUrl: string;
  assets: Array<{
    type: OfficeAssetType;
    sourceUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

type StudioConfigResponse = {
  defaultAssets?: Partial<Record<OfficeAssetType, string>>;
  layout?: StudioLayoutPayload | null;
};

type AssetCatalogItem = {
  type: PlaceableOfficeAssetType;
  label: string;
  icon: React.ReactNode;
  color: string;
};

type AssetCategory = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  items: AssetCatalogItem[];
};

const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: "mobilier",
    label: "Mobilier",
    icon: <Armchair className="w-4 h-4" />,
    color: "from-indigo-500/20 to-indigo-600/10",
    borderColor: "border-indigo-500/30",
    items: [
      {
        type: "desk_workstation",
        label: "Bureau PC",
        icon: <Monitor className="w-5 h-5" />,
        color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      },
      {
        type: "chair_office",
        label: "Chaise",
        icon: <Armchair className="w-5 h-5" />,
        color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      },
      {
        type: "cabinet_storage",
        label: "Armoire",
        icon: <Archive className="w-5 h-5" />,
        color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      },
    ],
  },
  {
    id: "deco",
    label: "Deco",
    icon: <Leaf className="w-4 h-4" />,
    color: "from-emerald-500/20 to-emerald-600/10",
    borderColor: "border-emerald-500/30",
    items: [
      {
        type: "plant_green_1",
        label: "Plante verte I",
        icon: <Leaf className="w-5 h-5" />,
        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      },
      {
        type: "plant_green_2",
        label: "Plante verte II",
        icon: <Leaf className="w-5 h-5" />,
        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      },
      {
        type: "plant_green_3",
        label: "Plante verte III",
        icon: <Leaf className="w-5 h-5" />,
        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      },
    ],
  },
  {
    id: "equipements",
    label: "Equipements",
    icon: <Coffee className="w-4 h-4" />,
    color: "from-amber-500/20 to-amber-600/10",
    borderColor: "border-amber-500/30",
    items: [
      {
        type: "trash_can",
        label: "Poubelle",
        icon: <Trash2 className="w-5 h-5" />,
        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      },
      {
        type: "water_fountain",
        label: "Fontaine a eau",
        icon: <Droplets className="w-5 h-5" />,
        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      },
      {
        type: "coffee_machine",
        label: "Machine a cafe",
        icon: <Coffee className="w-5 h-5" />,
        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      },
    ],
  },
];

function AssetThumb({
  url,
  label,
  icon,
  color,
  onAdd,
  onRegen,
  isLoading,
}: {
  url?: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onAdd: () => void;
  onRegen: () => void;
  isLoading: boolean;
}) {
  return (
    <div className={`relative group rounded-xl border ${color} overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10`}>
      <div className="aspect-square w-full relative bg-black/20">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            ) : (
              icon
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          onClick={onAdd}
          disabled={isLoading}
          className="absolute bottom-1 left-1 right-1 py-1 rounded-lg bg-indigo-500 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-400 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Ajouter
        </button>
      </div>
      <div className="px-2 py-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-white/70 truncate">{label}</span>
        <button
          onClick={onRegen}
          disabled={isLoading}
          title="Régénérer"
          className="ml-1 p-0.5 rounded text-white/30 hover:text-white/70 transition-colors disabled:opacity-30"
        >
          <Wand2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function SelectedAssetPanel({
  asset,
  onSize,
  onDuplicate,
  onDelete,
  onSaveDefault,
  onClose,
}: {
  asset: OfficeAssetInstance;
  onSize: (mult: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveDefault: () => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/40 backdrop-blur-sm overflow-hidden">
      <div className="px-3 py-2 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Asset sélectionné</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{ASSET_LABELS[asset.type] ?? asset.type}</p>
            <p className="text-xs text-white/40">{asset.width} × {asset.height} px</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onSize(0.85)}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" /> Réduire
          </button>
          <button
            onClick={() => onSize(1.15)}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" /> Agrandir
          </button>
          <button
            onClick={onDuplicate}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <Copy className="w-3.5 h-3.5" /> Dupliquer
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </div>

        <button
          onClick={onSaveDefault}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-all"
        >
          <Star className="w-3.5 h-3.5" /> Valider comme défaut
        </button>
      </div>
    </div>
  );
}

export function PixelArtOffice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: FALLBACK_CANVAS_W,
    height: FALLBACK_CANVAS_H,
  });
  const [canvasScale, setCanvasScale] = useState(1);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadingAssetType, setLoadingAssetType] = useState<OfficeAssetType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [studioImage, setStudioImage] = useState<HTMLImageElement | null>(null);
  const [studioAssetUrl, setStudioAssetUrl] = useState<string | null>(null);
  const [defaultAssetUrls, setDefaultAssetUrls] = useState<Partial<Record<OfficeAssetType, string>>>({});
  const [assets, setAssets] = useState<OfficeAssetInstance[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    mobilier: true,
    deco: true,
    equipements: true,
  });

  useEffect(() => {
    initializeStudio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      setCanvasScale(Math.min(1, width / canvasSize.width));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [canvasSize.width]);

  const stageW = canvasSize.width * canvasScale;
  const stageH = canvasSize.height * canvasScale;

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;

  const restoreLayout = async (layout: StudioLayoutPayload) => {
    const bg = await loadImage(layout.studioAssetUrl);
    if (!bg) throw new Error("Impossible de charger le fond sauvegarde.");

    const width = layout.canvas?.width || bg.naturalWidth || bg.width || FALLBACK_CANVAS_W;
    const height = layout.canvas?.height || bg.naturalHeight || bg.height || FALLBACK_CANVAS_H;

    const restoredAssets = await Promise.all(
      (layout.assets ?? []).map(async (asset, index) => {
        const image = await loadImage(asset.sourceUrl);
        if (!image) return null;
        return {
          id: `${asset.type}-${Date.now()}-${index}`,
          type: asset.type,
          sourceUrl: asset.sourceUrl,
          image,
          x: asset.x,
          y: asset.y,
          width: asset.width,
          height: asset.height,
        } satisfies OfficeAssetInstance;
      })
    );

    setStudioImage(bg);
    setStudioAssetUrl(layout.studioAssetUrl);
    setCanvasSize({ width, height });
    setAssets(restoredAssets.filter((asset): asset is OfficeAssetInstance => !!asset));
    setSelectedAssetId(null);
  };

  const initializeStudio = async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const configRes = await fetch("/api/office/studio-config", { cache: "no-store" });
      const config = (await configRes.json()) as StudioConfigResponse;

      const defaults = config.defaultAssets ?? {};
      setDefaultAssetUrls(defaults);

      if (config.layout) {
        await restoreLayout(config.layout);
        setPersistMessage("Studio restauré depuis la BDD.");
        setStatus("ready");
        return;
      }

      await loadStudioAsset(false, defaults);
    } catch {
      await loadStudioAsset(false);
    }
  };

  const loadStudioAsset = async (
    force = false,
    defaultsOverride?: Partial<Record<OfficeAssetType, string>>
  ) => {
    setStatus("loading");
    setLoadingAssetType("studio_empty");
    setErrorMessage(null);
    setPersistMessage(null);

    if (!force) {
      const defaultUrl = defaultsOverride?.studio_empty ?? defaultAssetUrls.studio_empty;
      if (defaultUrl) {
        const defaultImage = await loadImage(defaultUrl);
        if (defaultImage) {
          const width = defaultImage.naturalWidth || defaultImage.width || FALLBACK_CANVAS_W;
          const height = defaultImage.naturalHeight || defaultImage.height || FALLBACK_CANVAS_H;
          setStudioImage(defaultImage);
          setStudioAssetUrl(defaultUrl);
          setCanvasSize({ width, height });
          setStatus("ready");
          setLoadingAssetType(null);
          return;
        }
      }
    }

    const generated = await generateAndLoadAssetWithUrl("studio_empty", force);
    setLoadingAssetType(null);

    if (!generated) {
      setStatus("error");
      setErrorMessage("Impossible de générer le studio vide.");
      return;
    }

    const { image, url } = generated;
    const width = image.naturalWidth || image.width || FALLBACK_CANVAS_W;
    const height = image.naturalHeight || image.height || FALLBACK_CANVAS_H;

    setStudioImage(image);
    setStudioAssetUrl(url);
    setCanvasSize({ width, height });
    setStatus("ready");
  };

  const loadCatalogAsset = async (assetType: PlaceableOfficeAssetType, force = false) => {
    const placement = ASSET_PLACEMENT[assetType] ?? {
      idPrefix: "asset",
      baseSize: DEFAULT_ASSET_SIZE,
      errorMessage: "Impossible de generer cet asset.",
    };

    setStatus("loading");
    setLoadingAssetType(assetType);
    setErrorMessage(null);
    setPersistMessage(null);

    let sourceUrl = "";
    let image: HTMLImageElement | null = null;

    if (!force && defaultAssetUrls[assetType]) {
      sourceUrl = defaultAssetUrls[assetType] ?? "";
      image = await loadImage(sourceUrl);
    }

    if (!image) {
      const generated = await generateAndLoadAssetWithUrl(assetType, force);
      if (generated) {
        image = generated.image;
        sourceUrl = generated.url;
      }
    }

    setLoadingAssetType(null);

    if (!image || !sourceUrl) {
      setStatus("error");
      setErrorMessage(placement.errorMessage);
      return;
    }

    const now = Date.now();
    const newAsset: OfficeAssetInstance = {
      id: `${placement.idPrefix}-${now}`,
      type: assetType,
      sourceUrl,
      image,
      x: Math.round(canvasSize.width / 2 - placement.baseSize / 2),
      y: Math.round(canvasSize.height / 2 - placement.baseSize / 2),
      width: placement.baseSize,
      height: placement.baseSize,
    };

    setAssets((prev) => [...prev, newAsset]);
    setSelectedAssetId(newAsset.id);
    setStatus("ready");
  };

  const updateSelectedAssetSize = (multiplier: number) => {
    if (!selectedAssetId) return;

    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selectedAssetId) return asset;
        const nextWidth = Math.max(64, Math.min(1200, Math.round(asset.width * multiplier)));
        const nextHeight = Math.max(64, Math.min(1200, Math.round(asset.height * multiplier)));
        return { ...asset, width: nextWidth, height: nextHeight };
      })
    );
  };

  const duplicateSelectedAsset = () => {
    if (!selectedAsset) return;
    const duplicated: OfficeAssetInstance = {
      ...selectedAsset,
      id: `asset-${Date.now()}`,
      x: selectedAsset.x + 24,
      y: selectedAsset.y + 24,
    };
    setAssets((prev) => [...prev, duplicated]);
    setSelectedAssetId(duplicated.id);
  };

  const deleteSelectedAsset = () => {
    if (!selectedAssetId) return;
    setAssets((prev) => prev.filter((asset) => asset.id !== selectedAssetId));
    setSelectedAssetId(null);
  };

  const saveDefaultAsset = async (assetType: OfficeAssetType, url: string) => {
    try {
      setPersistMessage("Sauvegarde de l'asset par défaut...");
      const res = await fetch("/api/office/studio-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "default-asset", assetType, url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Echec sauvegarde");
      }

      setDefaultAssetUrls((data.defaultAssets ?? {}) as Partial<Record<OfficeAssetType, string>>);
      setPersistMessage(`Défaut mis à jour pour ${assetType}.`);
    } catch {
      setPersistMessage("Erreur lors de la sauvegarde.");
    }
  };

  const saveStudioLayout = async () => {
    if (!studioAssetUrl) {
      setPersistMessage("Générez d'abord un studio vide avant de sauvegarder.");
      return;
    }

    const layout: StudioLayoutPayload = {
      canvas: { width: canvasSize.width, height: canvasSize.height },
      studioAssetUrl,
      assets: assets.map((asset) => ({
        type: asset.type,
        sourceUrl: asset.sourceUrl,
        x: asset.x,
        y: asset.y,
        width: asset.width,
        height: asset.height,
      })),
    };

    try {
      setPersistMessage("Sauvegarde du studio...");
      const res = await fetch("/api/office/studio-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "layout", layout }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Echec sauvegarde studio");
      }

      setPersistMessage("Studio sauvegardé !");
    } catch {
      setPersistMessage("Erreur lors de la sauvegarde du studio.");
    }
  };

  const restoreStudioLayoutFromDb = async () => {
    try {
      setStatus("loading");
      setErrorMessage(null);
      setPersistMessage("Restauration du studio...");

      const res = await fetch("/api/office/studio-config", { cache: "no-store" });
      const data = (await res.json()) as StudioConfigResponse;

      if (!res.ok || !data.layout) {
        setPersistMessage("Aucun studio sauvegardé trouvé.");
        setStatus("ready");
        return;
      }

      await restoreLayout(data.layout);
      setPersistMessage("Studio restauré !");
      setStatus("ready");
    } catch {
      setStatus("error");
      setErrorMessage("Impossible de restaurer le studio.");
    }
  };

  const isGlobalLoading = status === "loading";
  const toggleCategory = (id: string) =>
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header toolbar ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{assets.length}</span>
            <span className="text-xs text-primary/60">assets</span>
          </div>

          {/* Fond du studio */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadStudioAsset(false)}
              disabled={isGlobalLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/80 border border-violet-400/30 text-white text-xs font-semibold hover:bg-violet-500/80 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/10"
            >
              {loadingAssetType === "studio_empty" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Générer fond
            </button>
            <button
              onClick={() => loadStudioAsset(true)}
              disabled={isGlobalLoading}
              title="Régénérer"
              className="p-1.5 rounded-xl border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
            {studioAssetUrl && (
              <button
                onClick={() => void saveDefaultAsset("studio_empty", studioAssetUrl)}
                disabled={isGlobalLoading}
                title="Valider comme fond par défaut"
                className="p-1.5 rounded-xl border border-emerald-400/20 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all disabled:opacity-30"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Save / Restore */}
        <div className="flex items-center gap-1.5">
          {persistMessage && (
            <span className="text-xs text-emerald-300/80 flex items-center gap-1">
              <Check className="w-3 h-3" />
              {persistMessage}
            </span>
          )}
          <button
            onClick={restoreStudioLayoutFromDb}
            disabled={isGlobalLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurer
          </button>
          <button
            onClick={saveStudioLayout}
            disabled={!studioImage || isGlobalLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/80 border border-emerald-400/30 text-white text-xs font-semibold hover:bg-emerald-500/80 transition-all disabled:opacity-40 shadow-lg shadow-emerald-500/10"
          >
            <Save className="w-3.5 h-3.5" />
            Sauvegarder
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-950/40 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {/* ── Main layout: sidebar + canvas ── */}
      <div className="flex gap-3 items-start">

        {/* ── Catalogue sidebar ── */}
        <div className="w-52 shrink-0 space-y-2">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest px-1">Catalogue</p>

          {ASSET_CATEGORIES.map((cat) => (
            <div key={cat.id} className={`rounded-2xl border ${cat.borderColor} bg-linear-to-b ${cat.color} overflow-hidden`}>
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/60">{cat.icon}</span>
                  <span className="text-xs font-bold text-white/80">{cat.label}</span>
                  <span className="text-xs text-white/30 bg-white/5 rounded-full px-1.5 py-0.5">
                    {cat.items.length}
                  </span>
                </div>
                {openCategories[cat.id] ? (
                  <ChevronUp className="w-3.5 h-3.5 text-white/30" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                )}
              </button>

              {openCategories[cat.id] && (
                <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
                  {cat.items.map((item) => (
                    <AssetThumb
                      key={item.type}
                      url={defaultAssetUrls[item.type]}
                      label={item.label}
                      icon={item.icon}
                      color={item.color}
                      isLoading={loadingAssetType === item.type}
                      onAdd={() => {
                        void loadCatalogAsset(item.type, false);
                      }}
                      onRegen={() => {
                        void loadCatalogAsset(item.type, true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Placeholder catégorie verrouillée */}
          <div className="rounded-2xl border border-white/5 bg-white/2 overflow-hidden opacity-40">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-white/30" />
                <span className="text-xs font-bold text-white/40">Fournitures</span>
                <span className="text-xs text-white/20 bg-white/5 rounded-full px-1.5 py-0.5">bientôt</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div className="flex-1 min-w-0 space-y-2">
          <div
            ref={containerRef}
            className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950"
          >
            {status === "idle" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <Sparkles className="w-8 h-8 text-violet-400/50" />
                <span>Générez le fond pour commencer</span>
              </div>
            )}

            {isGlobalLoading && !studioImage && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-white/50">Génération en cours...</span>
              </div>
            )}

            <Stage
              width={stageW}
              height={stageH}
              scaleX={canvasScale}
              scaleY={canvasScale}
              style={{ mixBlendMode: "normal" }}
              onClick={(e) => {
                if (e.target === e.target.getStage()) setSelectedAssetId(null);
              }}
            >
              <Layer>
                <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="#1a1025" />
                {studioImage && (
                  <KImage image={studioImage} x={0} y={0} width={canvasSize.width} height={canvasSize.height} />
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
                      onDragEnd={(evt) => {
                        const node = evt.target;
                        setAssets((prev) =>
                          prev.map((current) =>
                            current.id === asset.id
                              ? { ...current, x: node.x(), y: node.y() }
                              : current
                          )
                        );
                      }}
                      opacity={isSelected ? 1 : 0.95}
                      stroke={isSelected ? "#a5b4fc" : undefined}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                  );
                })}
              </Layer>

              <Layer listening={false}>
                <Text
                  x={12}
                  y={12}
                  text={
                    studioImage
                      ? `${canvasSize.width} × ${canvasSize.height}`
                      : "Le studio vide définira la taille du canvas"
                  }
                  fontSize={12}
                  fill="rgba(255,255,255,0.35)"
                />
              </Layer>
            </Stage>
          </div>

          {/* ── Selected asset panel (sous le canvas) ── */}
          {selectedAsset && (
            <SelectedAssetPanel
              asset={selectedAsset}
              onSize={updateSelectedAssetSize}
              onDuplicate={duplicateSelectedAsset}
              onDelete={deleteSelectedAsset}
              onSaveDefault={() => void saveDefaultAsset(selectedAsset.type, selectedAsset.sourceUrl)}
              onClose={() => setSelectedAssetId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
