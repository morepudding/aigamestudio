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

const LS_PREFIX = "office_asset_url_v2_";

function getCachedUrl(asset: OfficeAssetType): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_PREFIX + asset);
}

function setCachedUrl(asset: OfficeAssetType, url: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_PREFIX + asset, url);
}

/**
 * Fetch or generate one editor asset and return its public URL.
 * Uses localStorage as a first-level cache to avoid API calls on every page load.
 */
export async function fetchOrGenerateAsset(
  asset: OfficeAssetType,
  force = false
): Promise<string | null> {
  // Return localStorage cache immediately unless force=true
  if (!force) {
    const cached = getCachedUrl(asset);
    if (cached) return cached;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/ai/generate-office-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, force }),
      });

      const data = await res.json();
      if (data?.url) {
        setCachedUrl(asset, data.url);
        return data.url;
      }

      const message = typeof data?.error === "string" ? data.error : "Unknown asset generation error";
      if (!message.includes("429") || attempt === 2) {
        return null;
      }
    } catch {
      if (attempt === 2) {
        return null;
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1200 * (attempt + 1)));
  }

  return null;
}

/**
 * Load one URL into an HTMLImageElement for Konva.
 */
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
  force = false
): Promise<HTMLImageElement | null> {
  const url = await fetchOrGenerateAsset(asset, force);
  if (!url) return null;
  return loadImage(url);
}

export async function generateAndLoadAssetWithUrl(
  asset: OfficeAssetType,
  force = false
): Promise<{ url: string; image: HTMLImageElement } | null> {
  const url = await fetchOrGenerateAsset(asset, force);
  if (!url) return null;

  const image = await loadImage(url);
  if (!image) return null;

  return { url, image };
}
