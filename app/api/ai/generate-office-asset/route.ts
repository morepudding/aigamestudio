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

const STYLE = "16-bit isometric pixel art, transparent background, no white background, no shadows outside object";

// ─── Per-asset per-angle prompts ──────────────────────────────────────────────
// v1=NW (front-left face visible), v2=NE (front-right face visible),
// v3=SE (back-right, seen from behind), v4=SW (back-left face visible)
const PROMPTS: Record<OfficeAssetType, Record<AssetVariant, string>> = {
  studio_empty: {
    1: `${STYLE}, empty indie game studio interior, view from north-west: left wall and front wall visible, concrete floor, exposed brick`,
    2: `${STYLE}, empty indie game studio interior, view from north-east: right wall and front wall visible, concrete floor, exposed brick`,
    3: `${STYLE}, empty indie game studio interior, view from south-east: right wall and back wall visible, concrete floor, exposed brick`,
    4: `${STYLE}, empty indie game studio interior, view from south-west: left wall and back wall visible, concrete floor, exposed brick`,
  },
  desk_workstation: {
    1: `${STYLE}, wooden office desk with monitor facing viewer, keyboard on left side, mouse on right, view from north-west showing front-left of desk`,
    2: `${STYLE}, wooden office desk with monitor facing away from viewer, keyboard on right side, view from north-east showing front-right of desk`,
    3: `${STYLE}, wooden office desk seen from behind, back panel of monitor visible, cables visible, view from south-east`,
    4: `${STYLE}, wooden office desk seen from back-left, underside of desk visible, legs prominent, view from south-west`,
  },
  chair_office: {
    1: `${STYLE}, ergonomic office chair, dark fabric seat, view from north-west: front-left visible, seat cushion and armrest on left side prominent`,
    2: `${STYLE}, ergonomic office chair, dark fabric seat, view from north-east: front-right visible, seat cushion and armrest on right side prominent`,
    3: `${STYLE}, ergonomic office chair, dark fabric seat, view from south-east: backrest fully visible, back of headrest and lumbar support prominent`,
    4: `${STYLE}, ergonomic office chair, dark fabric seat, view from south-west: backrest visible from left side, lumbar support and left rear leg prominent`,
  },
  plant_green_1: {
    1: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from north-west: left leaves prominent`,
    2: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from north-east: right leaves prominent`,
    3: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from south-east: back leaves and stem visible`,
    4: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from south-west: back-left leaves and pot base visible`,
  },
  plant_green_2: {
    1: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from north-west`,
    2: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from north-east`,
    3: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from south-east: back of leaves visible`,
    4: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from south-west: back-left angle`,
  },
  plant_green_3: {
    1: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from north-west: left fronds drooping`,
    2: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from north-east: right fronds drooping`,
    3: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from south-east: back fronds visible`,
    4: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from south-west: back-left fronds`,
  },
  cabinet_storage: {
    1: `${STYLE}, metal office storage cabinet, closed doors with handle, view from north-west: front face and left side panel visible`,
    2: `${STYLE}, metal office storage cabinet, closed doors with handle, view from north-east: front face and right side panel visible`,
    3: `${STYLE}, metal office storage cabinet, view from south-east: back panel and right side visible, no handles`,
    4: `${STYLE}, metal office storage cabinet, view from south-west: back panel and left side visible, no handles`,
  },
  trash_can: {
    1: `${STYLE}, small office trash bin, round, open top, view from north-west: front-left visible`,
    2: `${STYLE}, small office trash bin, round, open top, view from north-east: front-right visible`,
    3: `${STYLE}, small office trash bin, round, open top, view from south-east: back-right visible`,
    4: `${STYLE}, small office trash bin, round, open top, view from south-west: back-left visible`,
  },
  water_fountain: {
    1: `${STYLE}, office water cooler with blue bottle on top, view from north-west: front-left, dispenser taps visible`,
    2: `${STYLE}, office water cooler with blue bottle on top, view from north-east: front-right, dispenser taps visible`,
    3: `${STYLE}, office water cooler with blue bottle on top, view from south-east: back-right panel, no taps`,
    4: `${STYLE}, office water cooler with blue bottle on top, view from south-west: back-left panel, no taps`,
  },
  coffee_machine: {
    1: `${STYLE}, office coffee machine, buttons and spout facing viewer, view from north-west: front-left, control panel and coffee spout prominent`,
    2: `${STYLE}, office coffee machine, view from north-east: front-right, side of machine and buttons visible`,
    3: `${STYLE}, office coffee machine, view from south-east: back of machine, ventilation grille visible`,
    4: `${STYLE}, office coffee machine, view from south-west: back-left, power cable visible`,
  },
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
async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const apiKey =
    process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const content = [{ type: "text", text: prompt }];

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

  if (!asset || !(asset in PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(PROMPTS).join(", ")}` },
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

  if (!asset || !(asset in PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(PROMPTS).join(", ")}` },
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

  // ── Generate — dedicated prompt per asset per angle ──────────────────────
  const prompt = PROMPTS[asset][variant];

  let buffer: Buffer;
  try {
    const ab = await generateImage(prompt);
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
