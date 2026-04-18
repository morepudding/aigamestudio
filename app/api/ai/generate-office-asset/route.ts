import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PNG } from "pngjs";

export const maxDuration = 120;

// ─── Types ────────────────────────────────────────────────────────────────────
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

// Variant 1 = north-west (default), 2 = north-east, 3 = south-east, 4 = south-west
export type AssetVariant = 1 | 2 | 3 | 4;

const VARIANT_LABELS: Record<AssetVariant, string> = {
  1: "NO",
  2: "NE",
  3: "SE",
  4: "SO",
};

// ─── Direction suffixes injected into prompts ─────────────────────────────────
const DIRECTION_SUFFIX: Record<AssetVariant, string> = {
  1: "isometric view from north-west angle",
  2: "isometric view from north-east angle, rotated 90 degrees clockwise",
  3: "isometric view from south-east angle, seen from behind, rotated 180 degrees",
  4: "isometric view from south-west angle, rotated 270 degrees clockwise",
};

// Instruction added when a reference image is provided (img2img)
const IMG2IMG_PREFIX =
  "Redraw the object in the reference image as isometric pixel art, 16-bit style, transparent background, no white background. Keep the same object, colors, and style.";

// ─── Base prompts (variant 1 / NW view) ──────────────────────────────────────
const BASE_PROMPTS: Record<OfficeAssetType, string> = {
  studio_empty:
    "isometric pixel art, brand-new empty indie game studio, bare concrete floor, exposed brick walls, large windows with morning light, no furniture, 16-bit style, transparent background, no white background",
  desk_workstation:
    "isometric pixel art, wooden office desk with computer monitor, keyboard and mouse, 16-bit style, transparent background, no white background",
  chair_office:
    "isometric pixel art, ergonomic office chair with wheels and soft dark fabric, 16-bit style, transparent background, no white background",
  plant_green_1:
    "isometric pixel art, potted green monstera plant with broad leaves, 16-bit style, transparent background, no white background",
  plant_green_2:
    "isometric pixel art, potted green snake plant with tall upright leaves, 16-bit style, transparent background, no white background",
  plant_green_3:
    "isometric pixel art, potted green fern plant with dense cascading leaves, 16-bit style, transparent background, no white background",
  cabinet_storage:
    "isometric pixel art, metal office storage cabinet with closed doors, 16-bit style, transparent background, no white background",
  trash_can:
    "isometric pixel art, small office trash bin, simple and clean, 16-bit style, transparent background, no white background",
  water_fountain:
    "isometric pixel art, office water cooler fountain with blue bottle, 16-bit style, transparent background, no white background",
  coffee_machine:
    "isometric pixel art, office coffee machine on compact stand, 16-bit style, transparent background, no white background",
};

const STORAGE_VERSION = "v3";
const BUCKET = "office-assets";

// ─── Supabase admin ───────────────────────────────────────────────────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// ─── Storage path for a given asset + variant ────────────────────────────────
function storagePath(asset: OfficeAssetType, variant: AssetVariant): string {
  return `editor-assets/${asset}-v${variant}-${STORAGE_VERSION}.png`;
}

// ─── Generate image via OpenRouter ───────────────────────────────────────────
// When referenceUrl is provided, uses img2img (image in messages content).
async function generateImage(
  prompt: string,
  referenceUrl?: string
): Promise<ArrayBuffer> {
  const apiKey =
    process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const content: ContentBlock[] = referenceUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: referenceUrl } },
      ]
    : [{ type: "text", text: prompt }];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[generate-office-asset] OpenRouter error:", res.status, err.slice(0, 200));
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;

  const images: Array<{ type: string; image_url?: { url: string } }> =
    message?.images ?? [];
  const msgContent = message?.content;

  let imageUrl: string | undefined;
  let base64Data: string | undefined;

  for (const block of images) {
    const url: string = block?.image_url?.url ?? "";
    if (url.startsWith("data:image")) {
      base64Data = url.split(",")[1];
    } else if (url) {
      imageUrl = url;
    }
    if (base64Data || imageUrl) break;
  }

  if (!base64Data && !imageUrl) {
    if (typeof msgContent === "string") {
      if (msgContent.startsWith("data:image")) {
        base64Data = msgContent.split(",")[1];
      } else if (msgContent.startsWith("http")) {
        imageUrl = msgContent.trim();
      }
    } else if (Array.isArray(msgContent)) {
      for (const block of msgContent) {
        if (block?.type === "image_url") {
          const url: string = block.image_url?.url ?? "";
          if (url.startsWith("data:image")) {
            base64Data = url.split(",")[1];
          } else {
            imageUrl = url;
          }
          if (base64Data || imageUrl) break;
        }
      }
    }
  }

  if (base64Data) {
    const binary = Buffer.from(base64Data, "base64");
    return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
  }

  if (imageUrl) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
    return imgRes.arrayBuffer();
  }

  console.error(
    "[generate-office-asset] Unexpected response:",
    JSON.stringify(json).slice(0, 300)
  );
  throw new Error("No image data found in OpenRouter response");
}

// ─── Background removal ───────────────────────────────────────────────────────
function removeBackground(imageBuffer: Buffer): Buffer {
  const png = PNG.sync.read(imageBuffer);
  const { width, height, data } = png;

  const THRESHOLD = 185;
  const idx = (x: number, y: number) => (y * width + x) * 4;

  const isBackground = (x: number, y: number): boolean => {
    const i = idx(x, y);
    const a = data[i + 3];
    if (a < 10) return true;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return r > THRESHOLD && g > THRESHOLD && b > THRESHOLD;
  };

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pos = y * width + x;
    if (visited[pos]) return;
    if (!isBackground(x, y)) return;
    visited[pos] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const y = queue.pop()!;
    const x = queue.pop()!;
    data[idx(x, y) + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return PNG.sync.write(png, { colorType: 6, filterType: 4 });
}

// ─── GET — list available variants for an asset ───────────────────────────────
// Returns { asset, variants: { 1: url|null, 2: url|null, 3: url|null, 4: url|null } }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get("asset") as OfficeAssetType | null;

  if (!asset || !(asset in BASE_PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(BASE_PROMPTS).join(", ")}` },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const variants: Record<AssetVariant, string | null> = { 1: null, 2: null, 3: null, 4: null };

  for (const v of [1, 2, 3, 4] as AssetVariant[]) {
    const path = storagePath(asset, v);
    const { data: existing } = await supabaseAdmin.storage
      .from(BUCKET)
      .list("editor-assets", { search: `${asset}-v${v}-${STORAGE_VERSION}.png`, limit: 1 });

    if (existing && existing.length > 0) {
      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      variants[v] = urlData.publicUrl;
    }
  }

  return NextResponse.json({ asset, variants, labels: VARIANT_LABELS });
}

// ─── POST — generate one variant ─────────────────────────────────────────────
// Body: { asset, variant: 1|2|3|4, force?: boolean }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const asset = body?.asset as OfficeAssetType | undefined;
  const variant = (body?.variant ?? 1) as AssetVariant;
  const forceRegenerate = body?.force === true;

  if (!asset || !(asset in BASE_PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(BASE_PROMPTS).join(", ")}` },
      { status: 400 }
    );
  }

  if (![1, 2, 3, 4].includes(variant)) {
    return NextResponse.json({ error: "variant must be 1, 2, 3, or 4" }, { status: 400 });
  }

  const path = storagePath(asset, variant);
  const supabaseAdmin = getSupabaseAdmin();

  // ── Cache check ───────────────────────────────────────────────────────────
  if (!forceRegenerate) {
    const { data: existing } = await supabaseAdmin.storage
      .from(BUCKET)
      .list("editor-assets", {
        search: `${asset}-v${variant}-${STORAGE_VERSION}.png`,
        limit: 1,
      });

    if (existing && existing.length > 0) {
      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({
        asset,
        variant,
        label: VARIANT_LABELS[variant],
        url: urlData.publicUrl,
        cached: true,
      });
    }
  }

  // ── Resolve reference image for img2img (variants 2/3/4 use variant 1) ────
  let referenceUrl: string | undefined;
  let prompt: string;

  if (variant === 1) {
    // Text-to-image for the base view
    prompt = `${BASE_PROMPTS[asset]}, ${DIRECTION_SUFFIX[1]}`;
  } else {
    // img2img: fetch variant 1 URL if it exists in storage
    const v1Path = storagePath(asset, 1);
    const { data: v1Files } = await supabaseAdmin.storage
      .from(BUCKET)
      .list("editor-assets", { search: `${asset}-v1-${STORAGE_VERSION}.png`, limit: 1 });

    if (v1Files && v1Files.length > 0) {
      const { data: v1UrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(v1Path);
      referenceUrl = v1UrlData.publicUrl;
      prompt = `${IMG2IMG_PREFIX} ${DIRECTION_SUFFIX[variant]}`;
    } else {
      // Fallback to text-to-image if variant 1 not yet generated
      prompt = `${BASE_PROMPTS[asset]}, ${DIRECTION_SUFFIX[variant]}`;
    }
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    const ab = await generateImage(prompt, referenceUrl);
    buffer = Buffer.from(ab);
  } catch (err) {
    console.error("[generate-office-asset] Generation failed:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  // ── Background removal ────────────────────────────────────────────────────
  try {
    buffer = removeBackground(buffer);
  } catch (err) {
    const message = (err as Error).message;
    console.error("[generate-office-asset] Cutout failed:", message);
    return NextResponse.json({ error: `Cutout failed: ${message}` }, { status: 502 });
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    console.error("[generate-office-asset] Upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 502 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    asset,
    variant,
    label: VARIANT_LABELS[variant],
    url: urlData.publicUrl + `?t=${Date.now()}`,
    cached: false,
  });
}

// ─── DELETE — clear all variants for all assets ───────────────────────────────
export async function DELETE() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list("editor-assets", {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    return NextResponse.json({ error: "Unable to list editor-assets folder" }, { status: 502 });
  }

  const paths = (files ?? [])
    .filter((f) => !!f.name && f.name !== ".emptyFolderPlaceholder")
    .map((f) => `editor-assets/${f.name}`);

  if (paths.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No office assets found" });
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 502 });
  }

  return NextResponse.json({ deleted: paths.length, paths });
}
