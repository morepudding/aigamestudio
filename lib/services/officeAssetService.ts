// Service for the office pixel editor (on-demand generation + manual placement)

export type OfficeAssetType =
  | "studio_empty"
  | "desk_workstation"
  | "chair_office"
  | "plant_green_1"
  | "plant_green_2"
  | "plant_green_3"
  | "cabinet_storage"
  | "trash_can"
  | "water_fountain"
  | "coffee_machine";

export type AssetVariant = 1 | 2 | 3 | 4;

export const VARIANT_LABELS: Record<AssetVariant, string> = {
  1: "NO",
  2: "NE",
  3: "SE",
  4: "SO",
};

// Cached variant URLs per asset: Record<asset, Record<variant, url>>
type VariantCache = Partial<Record<OfficeAssetType, Partial<Record<AssetVariant, string>>>>;

const LS_KEY = "office_asset_variants_v3";

function getCache(): VariantCache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as VariantCache;
  } catch {
    return {};
  }
}

function setCache(cache: VariantCache) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(cache));
}

function getCachedVariantUrl(asset: OfficeAssetType, variant: AssetVariant): string | null {
  return getCache()[asset]?.[variant] ?? null;
}

function setCachedVariantUrl(asset: OfficeAssetType, variant: AssetVariant, url: string) {
  const cache = getCache();
  cache[asset] = { ...cache[asset], [variant]: url };
  setCache(cache);
}

// ─── Fetch all known variants for an asset from the API ──────────────────────
export async function fetchAssetVariants(
  asset: OfficeAssetType
): Promise<Partial<Record<AssetVariant, string>>> {
  const res = await fetch(`/api/ai/generate-office-asset?asset=${asset}`);
  if (!res.ok) return {};
  const data = await res.json() as { variants: Partial<Record<AssetVariant, string | null>> };
  const result: Partial<Record<AssetVariant, string>> = {};
  for (const [k, url] of Object.entries(data.variants ?? {})) {
    if (url) {
      const v = Number(k) as AssetVariant;
      result[v] = url;
      setCachedVariantUrl(asset, v, url);
    }
  }
  return result;
}

// ─── Generate (or fetch cached) a specific variant ───────────────────────────
export async function fetchOrGenerateVariant(
  asset: OfficeAssetType,
  variant: AssetVariant,
  force = false
): Promise<string | null> {
  if (!force) {
    const cached = getCachedVariantUrl(asset, variant);
    if (cached) return cached;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/ai/generate-office-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, variant, force }),
      });

      const data = await res.json() as { url?: string; error?: string };
      if (data?.url) {
        setCachedVariantUrl(asset, variant, data.url);
        return data.url;
      }

      const message = typeof data?.error === "string" ? data.error : "Unknown error";
      if (!message.includes("429") || attempt === 2) return null;
    } catch {
      if (attempt === 2) return null;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1200 * (attempt + 1)));
  }

  return null;
}

// ─── Load a URL into an HTMLImageElement ─────────────────────────────────────
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generateAndLoadAsset(
  asset: OfficeAssetType,
  variant: AssetVariant = 1,
  force = false
): Promise<HTMLImageElement | null> {
  const url = await fetchOrGenerateVariant(asset, variant, force);
  if (!url) return null;
  return loadImage(url);
}

export async function generateAndLoadAssetWithUrl(
  asset: OfficeAssetType,
  variant: AssetVariant = 1,
  force = false
): Promise<{ url: string; image: HTMLImageElement } | null> {
  const url = await fetchOrGenerateVariant(asset, variant, force);
  if (!url) return null;
  const image = await loadImage(url);
  if (!image) return null;
  return { url, image };
}
