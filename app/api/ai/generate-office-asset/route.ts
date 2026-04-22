import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PNG } from "pngjs";
import { generatePixelArtLocally, generateImg2ImgLocally } from "@/lib/services/comfyui";

export const maxDuration = 300;

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
  | "coffee_machine"
  | "wall_poster"
  | "wall_shelf"
  | "wall_neon_sign"
  | "desk_lamp"
  | "floor_lamp"
  | "neon_light";

// Variant 1 = north-west (default), 2 = north-east, 3 = south-east, 4 = south-west
export type AssetVariant = 1 | 2 | 3 | 4;
type AssetAttempt = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type OutputMode = "raw" | "approved";

const VARIANT_LABELS: Record<AssetVariant, string> = {
  1: "NO",
  2: "NE",
  3: "SE",
  4: "SO",
};

const STYLE = "16-bit isometric pixel art sprite, ONE single isolated object ONLY, crisp pixel outlines, clean pixel edges, limited color palette, game asset style, transparent background, no floor, no room, no walls, no other furniture nearby, object alone centered on transparent background";
const LORA_TAG = process.env.SD_ISOMETRIC_LORA
  ? `<lora:${process.env.SD_ISOMETRIC_LORA}:${process.env.SD_ISOMETRIC_LORA_WEIGHT ?? "0.7"}>`
  : "";
const SCENE_PREFIX = LORA_TAG ? `Isometric_Setting, ` : "";

// ─── Per-asset per-angle prompts ──────────────────────────────────────────────
// v1=NW (front-left face visible), v2=NE (front-right face visible),
// v3=SE (back-right, seen from behind), v4=SW (back-left face visible)
const PROMPTS: Record<OfficeAssetType, Record<AssetVariant, string>> = {
  studio_empty: {
    1: `${SCENE_PREFIX}${STYLE}, empty indie game studio interior, view from north-west: left wall and front wall visible, concrete floor, exposed brick ${LORA_TAG}`,
    2: `${SCENE_PREFIX}${STYLE}, empty indie game studio interior, view from north-east: right wall and front wall visible, concrete floor, exposed brick ${LORA_TAG}`,
    3: `${SCENE_PREFIX}${STYLE}, empty indie game studio interior, view from south-east: right wall and back wall visible, concrete floor, exposed brick ${LORA_TAG}`,
    4: `${SCENE_PREFIX}${STYLE}, empty indie game studio interior, view from south-west: left wall and back wall visible, concrete floor, exposed brick ${LORA_TAG}`,
  },
  desk_workstation: {
    1: `${STYLE}, simple flat rectangular wooden desk, ONE monitor on desk surface, keyboard in front, mouse to the right, NO chair, NO person, isometric north-west angle, front face and left side of desk visible`,
    2: `${STYLE}, simple flat rectangular wooden desk, ONE monitor on desk surface, keyboard in front, mouse to the left, NO chair, NO person, isometric north-east angle, front face and right side of desk visible`,
    3: `${STYLE}, simple flat rectangular wooden desk seen from behind, back of monitor visible, cables hanging, NO chair, NO person, isometric south-east angle`,
    4: `${STYLE}, simple flat rectangular wooden desk seen from back-left, four legs visible, NO chair, NO person, isometric south-west angle`,
  },
  chair_office: {
    1: `${STYLE}, single ergonomic swivel office chair, five-wheel star base, padded dark seat, backrest, two armrests, NO desk, NO monitor, NO room, isometric north-west angle, front-left face visible`,
    2: `${STYLE}, single ergonomic swivel office chair, five-wheel star base, padded dark seat, backrest, two armrests, NO desk, NO monitor, NO room, isometric north-east angle, front-right face visible`,
    3: `${STYLE}, single ergonomic swivel office chair seen from behind, backrest and headrest prominent, five-wheel base, NO desk, NO monitor, isometric south-east angle`,
    4: `${STYLE}, single ergonomic swivel office chair seen from back-left, lumbar support visible, five-wheel base, NO desk, NO monitor, isometric south-west angle`,
  },
  plant_green_1: {
    1: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from north-west: left leaves prominent ${LORA_TAG}`,
    2: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from north-east: right leaves prominent ${LORA_TAG}`,
    3: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from south-east: back leaves and stem visible ${LORA_TAG}`,
    4: `${STYLE}, potted monstera plant, broad tropical leaves, terracotta pot, view from south-west: back-left leaves and pot base visible ${LORA_TAG}`,
  },
  plant_green_2: {
    1: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from north-west ${LORA_TAG}`,
    2: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from north-east ${LORA_TAG}`,
    3: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from south-east: back of leaves visible ${LORA_TAG}`,
    4: `${STYLE}, potted snake plant, tall upright sword-shaped leaves, white pot, view from south-west: back-left angle ${LORA_TAG}`,
  },
  plant_green_3: {
    1: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from north-west: left fronds drooping ${LORA_TAG}`,
    2: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from north-east: right fronds drooping ${LORA_TAG}`,
    3: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from south-east: back fronds visible ${LORA_TAG}`,
    4: `${STYLE}, potted fern plant, dense cascading fronds, round pot, view from south-west: back-left fronds ${LORA_TAG}`,
  },
  cabinet_storage: {
    1: `${STYLE}, single narrow tall storage cabinet, ONE front door with a horizontal handle bar, light beige wooden body, NO other furniture, isometric north-west angle, front and left side visible`,
    2: `${STYLE}, single narrow tall storage cabinet, ONE front door with a horizontal handle bar, light beige wooden body, NO other furniture, isometric north-east angle, front and right side visible`,
    3: `${STYLE}, single narrow tall storage cabinet, light beige wooden body, NO other furniture, isometric south-east angle, back and right side visible`,
    4: `${STYLE}, single narrow tall storage cabinet, light beige wooden body, NO other furniture, isometric south-west angle, back and left side visible`,
  },
  trash_can: {
    1: `${STYLE}, single small cylindrical office trash bin, dark color, open top, NO other objects around it, isometric north-west angle`,
    2: `${STYLE}, single small cylindrical office trash bin, dark color, open top, NO other objects around it, isometric north-east angle`,
    3: `${STYLE}, single small cylindrical office trash bin, dark color, NO other objects, isometric south-east angle`,
    4: `${STYLE}, single small cylindrical office trash bin, dark color, NO other objects, isometric south-west angle`,
  },
  water_fountain: {
    1: `${STYLE}, single office water cooler dispenser, large blue water bottle on top, white body, two tap buttons at front, NO other objects, isometric north-west angle, front-left visible`,
    2: `${STYLE}, single office water cooler dispenser, large blue water bottle on top, white body, two tap buttons at front, NO other objects, isometric north-east angle, front-right visible`,
    3: `${STYLE}, single office water cooler dispenser, large blue water bottle on top, white body, NO other objects, isometric south-east angle, back panel visible`,
    4: `${STYLE}, single office water cooler dispenser, large blue water bottle on top, white body, NO other objects, isometric south-west angle, back-left visible`,
  },
  coffee_machine: {
    1: `${STYLE}, single compact coffee machine, black body, front panel with buttons and coffee spout, NO other objects, isometric north-west angle, front-left face visible`,
    2: `${STYLE}, single compact coffee machine, black body, front panel with buttons and coffee spout, NO other objects, isometric north-east angle, front-right face visible`,
    3: `${STYLE}, single compact coffee machine, black body, back panel with ventilation, NO other objects, isometric south-east angle`,
    4: `${STYLE}, single compact coffee machine, black body, back-left panel with power cable, NO other objects, isometric south-west angle`,
  },
  wall_poster: {
    1: `${STYLE}, single framed indie game poster for office wall, warm accent colors, mounted flat, subtle shadow, isometric north-west wall-facing presentation ${LORA_TAG}`,
    2: `${STYLE}, single framed indie game poster for office wall, warm accent colors, mounted flat, subtle shadow, isometric north-east wall-facing presentation ${LORA_TAG}`,
    3: `${STYLE}, single framed indie game poster for office wall, graphic composition, mounted flat, isometric south-east wall-facing presentation ${LORA_TAG}`,
    4: `${STYLE}, single framed indie game poster for office wall, graphic composition, mounted flat, isometric south-west wall-facing presentation ${LORA_TAG}`,
  },
  wall_shelf: {
    1: `${STYLE}, single compact wall shelf, light wood plank with two simple brackets, tiny book stack and one small plant, mounted on wall, isometric north-west presentation ${LORA_TAG}`,
    2: `${STYLE}, single compact wall shelf, light wood plank with two simple brackets, tiny book stack and one small plant, mounted on wall, isometric north-east presentation ${LORA_TAG}`,
    3: `${STYLE}, single compact wall shelf, light wood plank with two simple brackets, sparse decoration, mounted on wall, isometric south-east presentation ${LORA_TAG}`,
    4: `${STYLE}, single compact wall shelf, light wood plank with two simple brackets, sparse decoration, mounted on wall, isometric south-west presentation ${LORA_TAG}`,
  },
  wall_neon_sign: {
    1: `${STYLE}, single wall-mounted neon sign, compact geometric glow tube, cyan and amber light, fixed to wall, isometric north-west presentation ${LORA_TAG}`,
    2: `${STYLE}, single wall-mounted neon sign, compact geometric glow tube, cyan and amber light, fixed to wall, isometric north-east presentation ${LORA_TAG}`,
    3: `${STYLE}, single wall-mounted neon sign, compact geometric glow tube, magenta and blue light, fixed to wall, isometric south-east presentation ${LORA_TAG}`,
    4: `${STYLE}, single wall-mounted neon sign, compact geometric glow tube, magenta and blue light, fixed to wall, isometric south-west presentation ${LORA_TAG}`,
  },
  desk_lamp: {
    1: `${STYLE}, single articulated desk lamp, warm bulb glow, matte metal base, compact office accessory, isometric north-west angle ${LORA_TAG}`,
    2: `${STYLE}, single articulated desk lamp, warm bulb glow, matte metal base, compact office accessory, isometric north-east angle ${LORA_TAG}`,
    3: `${STYLE}, single articulated desk lamp, warm bulb glow, matte metal base, compact office accessory, isometric south-east angle ${LORA_TAG}`,
    4: `${STYLE}, single articulated desk lamp, warm bulb glow, matte metal base, compact office accessory, isometric south-west angle ${LORA_TAG}`,
  },
  floor_lamp: {
    1: `${STYLE}, single slim floor lamp, frosted shade, cool ambient light, minimal studio decor, isometric north-west angle ${LORA_TAG}`,
    2: `${STYLE}, single slim floor lamp, frosted shade, cool ambient light, minimal studio decor, isometric north-east angle ${LORA_TAG}`,
    3: `${STYLE}, single slim floor lamp, frosted shade, cool ambient light, minimal studio decor, isometric south-east angle ${LORA_TAG}`,
    4: `${STYLE}, single slim floor lamp, frosted shade, cool ambient light, minimal studio decor, isometric south-west angle ${LORA_TAG}`,
  },
  neon_light: {
    1: `${STYLE}, single decorative neon tube light, soft colored glow, compact studio sign, isolated object, isometric north-west angle ${LORA_TAG}`,
    2: `${STYLE}, single decorative neon tube light, soft colored glow, compact studio sign, isolated object, isometric north-east angle ${LORA_TAG}`,
    3: `${STYLE}, single decorative neon tube light, soft colored glow, compact studio sign, isolated object, isometric south-east angle ${LORA_TAG}`,
    4: `${STYLE}, single decorative neon tube light, soft colored glow, compact studio sign, isolated object, isometric south-west angle ${LORA_TAG}`,
  },
};

const STORAGE_VERSION = "v4";
const BUCKET = "office-assets";
const NORMALIZED_CANVAS_SIZE = 512;
const NORMALIZED_PADDING = 24;

// ─── Supabase admin ───────────────────────────────────────────────────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// ─── Storage path for a given asset + variant (+ optional raw attempt) ───────
function storagePath(
  asset: OfficeAssetType,
  variant: AssetVariant,
  attempt?: AssetAttempt,
  outputMode: OutputMode = "raw"
): string {
  if (outputMode === "approved") {
    return `editor-assets/${asset}-v${variant}-approved-${STORAGE_VERSION}.png`;
  }

  if (attempt && attempt > 1) {
    return `editor-assets/${asset}-v${variant}-a${attempt}-${STORAGE_VERSION}.png`;
  }

  return `editor-assets/${asset}-v${variant}-${STORAGE_VERSION}.png`;
}

// ─── Background removal (flood-fill from edges) ───────────────────────────────
function removeBackground(imageBuffer: Buffer): Buffer {
  const png = PNG.sync.read(imageBuffer);
  const { width, height, data } = png;
  const THRESHOLD = 230;
  const idx = (x: number, y: number) => (y * width + x) * 4;

  const isBackground = (x: number, y: number): boolean => {
    const i = idx(x, y);
    if (data[i + 3] < 10) return true;
    return data[i] > THRESHOLD && data[i + 1] > THRESHOLD && data[i + 2] > THRESHOLD;
  };

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pos = y * width + x;
    if (visited[pos] || !isBackground(x, y)) return;
    visited[pos] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  while (queue.length > 0) {
    const y = queue.pop()!;
    const x = queue.pop()!;
    data[idx(x, y) + 3] = 0;
    enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
  }

  stripEdgeShadow(png);

  return PNG.sync.write(png, { colorType: 6, filterType: 4 });
}

function stripEdgeShadow(png: InstanceType<typeof PNG>) {
  const { width, height, data } = png;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const isResidualShadow = (x: number, y: number): boolean => {
    const i = idx(x, y);
    const alpha = data[i + 3];
    if (alpha < 16) return false;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const avg = (r + g + b) / 3;
    const neutral = maxChannel - minChannel <= 24;
    const softTone = avg >= 45 && avg <= 210;

    return neutral && softTone;
  };

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pos = y * width + x;
    if (visited[pos] || !isResidualShadow(x, y)) return;
    visited[pos] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, height - 1);
    enqueue(x, 0);
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
}

function findOpaqueBounds(png: InstanceType<typeof PNG>) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 10) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function normalizeSprite(imageBuffer: Buffer): Buffer {
  const source = PNG.sync.read(imageBuffer);
  stripEdgeShadow(source);
  const bounds = findOpaqueBounds(source);

  if (!bounds) return imageBuffer;

  const canvas = new PNG({ width: NORMALIZED_CANVAS_SIZE, height: NORMALIZED_CANVAS_SIZE });
  canvas.data.fill(0);

  const maxTargetWidth = NORMALIZED_CANVAS_SIZE - NORMALIZED_PADDING * 2;
  const maxTargetHeight = NORMALIZED_CANVAS_SIZE - NORMALIZED_PADDING * 2;
  const scale = Math.min(maxTargetWidth / bounds.width, maxTargetHeight / bounds.height, 1);
  const scaledWidth = Math.max(1, Math.round(bounds.width * scale));
  const scaledHeight = Math.max(1, Math.round(bounds.height * scale));
  const offsetX = Math.round((NORMALIZED_CANVAS_SIZE - scaledWidth) / 2);
  const offsetY = Math.max(
    NORMALIZED_PADDING,
    Math.min(
      NORMALIZED_CANVAS_SIZE - NORMALIZED_PADDING - scaledHeight,
      Math.round((NORMALIZED_CANVAS_SIZE - scaledHeight) / 2 + NORMALIZED_CANVAS_SIZE * 0.08)
    )
  );

  for (let targetY = 0; targetY < scaledHeight; targetY++) {
    const sourceY = bounds.minY + Math.min(bounds.height - 1, Math.floor(targetY / scale));
    for (let targetX = 0; targetX < scaledWidth; targetX++) {
      const sourceX = bounds.minX + Math.min(bounds.width - 1, Math.floor(targetX / scale));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const targetIndex = ((offsetY + targetY) * canvas.width + (offsetX + targetX)) * 4;

      canvas.data[targetIndex] = source.data[sourceIndex];
      canvas.data[targetIndex + 1] = source.data[sourceIndex + 1];
      canvas.data[targetIndex + 2] = source.data[sourceIndex + 2];
      canvas.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }

  return PNG.sync.write(canvas, { colorType: 6, filterType: 4 });
}

// ─── Generate helpers ─────────────────────────────────────────────────────────
async function generateImage(prompt: string): Promise<Buffer> {
  const result = await generatePixelArtLocally({ prompt, width: 512, height: 512 });
  return removeBackground(result.buffer);
}

async function generateImageFromInit(prompt: string, initBuffer: Buffer): Promise<Buffer> {
  const result = await generateImg2ImgLocally({
    prompt,
    initImageBuffer: initBuffer,
    width: 512,
    height: 512,
    denoise: 0.65,
  });
  return removeBackground(result.buffer);
}

// ─── GET — list available variants for an asset ───────────────────────────────
// Returns { asset, variants: { 1: url|null, 2: url|null, 3: url|null, 4: url|null } }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get("asset") as OfficeAssetType | null;
  const variantParam = searchParams.get("variant");
  const includeAttempts = searchParams.get("includeAttempts") === "true";
  const includeApproved = searchParams.get("includeApproved") === "true";

  if (!asset || !(asset in PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(PROMPTS).join(", ")}` },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const variants: Record<AssetVariant, string | null> = { 1: null, 2: null, 3: null, 4: null };

  if (includeApproved && variantParam) {
    const variant = Number(variantParam) as AssetVariant;

    if (![1, 2, 3, 4].includes(variant)) {
      return NextResponse.json({ error: "variant must be 1, 2, 3, or 4" }, { status: 400 });
    }

    const path = storagePath(asset, variant, undefined, "approved");
    const search = `${asset}-v${variant}-approved-${STORAGE_VERSION}.png`;
    const { data: existing } = await supabaseAdmin.storage
      .from(BUCKET)
      .list("editor-assets", { search, limit: 1 });

    if (!existing || existing.length === 0) {
      return NextResponse.json({ asset, variant, approvedUrl: null, label: VARIANT_LABELS[variant] });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ asset, variant, approvedUrl: urlData.publicUrl, label: VARIANT_LABELS[variant] });
  }

  if (includeAttempts && variantParam) {
    const variant = Number(variantParam) as AssetVariant;

    if (![1, 2, 3, 4].includes(variant)) {
      return NextResponse.json({ error: "variant must be 1, 2, 3, or 4" }, { status: 400 });
    }

    const attempts: Array<{ attempt: number; url: string }> = [];

    for (const attempt of [1, 2, 3, 4, 5, 6, 7, 8] as AssetAttempt[]) {
      const path = storagePath(asset, variant, attempt);
      const search = attempt > 1
        ? `${asset}-v${variant}-a${attempt}-${STORAGE_VERSION}.png`
        : `${asset}-v${variant}-${STORAGE_VERSION}.png`;

      const { data: existing } = await supabaseAdmin.storage
        .from(BUCKET)
        .list("editor-assets", { search, limit: 1 });

      if (existing && existing.length > 0) {
        const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        attempts.push({ attempt, url: urlData.publicUrl });
      }
    }

    return NextResponse.json({ asset, variant, attempts, label: VARIANT_LABELS[variant] });
  }

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
// Body: { asset, variant: 1|2|3|4, attempt?: 1..8, force?: boolean, use_v1_init?: boolean }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const asset = body?.asset as OfficeAssetType | undefined;
  const variant = (body?.variant ?? 1) as AssetVariant;
  const attempt = (body?.attempt ?? 1) as AssetAttempt;
  const sourceAttempt = (body?.sourceAttempt ?? attempt) as AssetAttempt;
  const outputMode = (body?.outputMode ?? "raw") as OutputMode;
  const normalizeExisting = body?.normalizeExisting === true;
  const forceRegenerate = body?.force === true;
  const useV1Init = body?.use_v1_init === true && variant !== 1;

  if (!asset || !(asset in PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(PROMPTS).join(", ")}` },
      { status: 400 }
    );
  }

  if (![1, 2, 3, 4].includes(variant)) {
    return NextResponse.json({ error: "variant must be 1, 2, 3, or 4" }, { status: 400 });
  }

  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(attempt)) {
    return NextResponse.json({ error: "attempt must be between 1 and 8" }, { status: 400 });
  }

  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(sourceAttempt)) {
    return NextResponse.json({ error: "sourceAttempt must be between 1 and 8" }, { status: 400 });
  }

  if (!["raw", "approved"].includes(outputMode)) {
    return NextResponse.json({ error: "outputMode must be raw or approved" }, { status: 400 });
  }

  const path = storagePath(asset, variant, attempt, outputMode);
  const supabaseAdmin = getSupabaseAdmin();
  const search = outputMode === "approved"
    ? `${asset}-v${variant}-approved-${STORAGE_VERSION}.png`
    : attempt > 1
      ? `${asset}-v${variant}-a${attempt}-${STORAGE_VERSION}.png`
      : `${asset}-v${variant}-${STORAGE_VERSION}.png`;

  // ── Cache check ───────────────────────────────────────────────────────────
  if (!forceRegenerate) {
    const { data: existing } = await supabaseAdmin.storage
      .from(BUCKET)
      .list("editor-assets", {
        search,
        limit: 1,
      });

    if (existing && existing.length > 0) {
      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({
        asset,
        variant,
        attempt,
        label: VARIANT_LABELS[variant],
        url: urlData.publicUrl,
        cached: true,
      });
    }
  }

  let buffer: Buffer;
  try {
    if (outputMode === "approved" && normalizeExisting) {
      const sourcePath = storagePath(asset, variant, sourceAttempt, "raw");
      const { data: sourceData, error: sourceErr } = await supabaseAdmin.storage.from(BUCKET).download(sourcePath);
      if (sourceErr || !sourceData) throw new Error("Raw source attempt not found — generate it first");
      const sourceBuffer = Buffer.from(await sourceData.arrayBuffer());
      buffer = normalizeSprite(sourceBuffer);
    } else {
      // ── Generate — dedicated prompt per asset per angle ──────────────────
      const prompt = PROMPTS[asset][variant];

      if (useV1Init) {
        const v1Path = storagePath(asset, 1);
        const { data: v1Data, error: v1Err } = await supabaseAdmin.storage.from(BUCKET).download(v1Path);
        if (v1Err || !v1Data) throw new Error("V1 (NO) not found — generate it first");
        const v1Buffer = Buffer.from(await v1Data.arrayBuffer());
        buffer = await generateImageFromInit(prompt, v1Buffer);
      } else {
        buffer = await generateImage(prompt);
      }
    }
  } catch (err) {
    console.error("[generate-office-asset] Generation failed:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
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
    attempt,
    outputMode,
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
