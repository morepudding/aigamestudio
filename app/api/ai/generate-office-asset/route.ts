import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PNG } from "pngjs";

export const maxDuration = 120;

// ─── Asset types ─────────────────────────────────────────────────────────────
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

type AssetType = OfficeAssetType;

// ─── Pixel art prompts per asset ─────────────────────────────────────────────
const PROMPTS: Record<AssetType, string> = {
  studio_empty: "isometric pixel art, brand-new empty indie game studio, bare concrete floor, exposed brick walls, large windows with morning light, no furniture, 16-bit style, transparent background, no white background",
  desk_workstation: "isometric pixel art, wooden office desk with computer monitor, keyboard and mouse, 16-bit style, transparent background, no white background",
  chair_office: "isometric pixel art, ergonomic office chair with wheels and soft dark fabric, 16-bit style, transparent background, no white background",
  plant_green_1: "isometric pixel art, potted green monstera plant with broad leaves, 16-bit style, transparent background, no white background",
  plant_green_2: "isometric pixel art, potted green snake plant with tall upright leaves, 16-bit style, transparent background, no white background",
  plant_green_3: "isometric pixel art, potted green fern plant with dense cascading leaves, 16-bit style, transparent background, no white background",
  cabinet_storage: "isometric pixel art, metal office storage cabinet with closed doors, 16-bit style, transparent background, no white background",
  trash_can: "isometric pixel art, small office trash bin, simple and clean, 16-bit style, transparent background, no white background",
  water_fountain: "isometric pixel art, office water cooler fountain with blue bottle, 16-bit style, transparent background, no white background",
  coffee_machine: "isometric pixel art, office coffee machine on compact stand, 16-bit style, transparent background, no white background",
};

const CUTOUT_STORAGE_VERSION = "v2";

// ─── Supabase admin client (service role for storage upserts) ────────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/**
 * Generate an image via OpenRouter chat completions (Gemini 2.5 Flash Image).
 * Returns the image as an ArrayBuffer (binary PNG).
 */
async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[generate-office-asset] OpenRouter error:", res.status, err.slice(0, 200));
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;

  // OpenRouter image models return images in message.images[] (not message.content)
  const images: Array<{ type: string; image_url?: { url: string } }> = message?.images ?? [];
  const content = message?.content;

  let imageUrl: string | undefined;
  let base64Data: string | undefined;

  // 1. Check message.images (OpenRouter native format for Gemini image models)
  for (const block of images) {
    const url: string = block?.image_url?.url ?? "";
    if (url.startsWith("data:image")) {
      base64Data = url.split(",")[1];
    } else if (url) {
      imageUrl = url;
    }
    if (base64Data || imageUrl) break;
  }

  // 2. Fallback: check message.content (array or string)
  if (!base64Data && !imageUrl) {
    if (typeof content === "string") {
      if (content.startsWith("data:image")) {
        base64Data = content.split(",")[1];
      } else if (content.startsWith("http")) {
        imageUrl = content.trim();
      }
    } else if (Array.isArray(content)) {
      for (const block of content) {
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

  console.error("[generate-office-asset] Unexpected response:", JSON.stringify(json).slice(0, 300));
  throw new Error("No image data found in OpenRouter response");
}

/**
 * Remove background via BFS flood-fill from the image edges.
 * Pixels connected to the border that are "light/neutral" (the AI checkerboard or
 * white background) are made fully transparent. Pure algorithmic — no AI call.
 */
function removeBackground(imageBuffer: Buffer): Buffer {
  const png = PNG.sync.read(imageBuffer);
  const { width, height, data } = png;

  const THRESHOLD = 185; // pixels with R,G,B all above this are background candidates

  const idx = (x: number, y: number) => (y * width + x) * 4;

  const isBackground = (x: number, y: number): boolean => {
    const i = idx(x, y);
    const a = data[i + 3];
    if (a < 10) return true; // already transparent
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

  // Seed from all 4 borders
  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  while (queue.length > 0) {
    const y = queue.pop()!;
    const x = queue.pop()!;
    data[idx(x, y) + 3] = 0; // make transparent
    enqueue(x + 1, y); enqueue(x - 1, y);
    enqueue(x, y + 1); enqueue(x, y - 1);
  }

  return PNG.sync.write(png, { colorType: 6, filterType: 4 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const asset = body?.asset as AssetType | undefined;
  const forceRegenerate = body?.force === true;

  if (!asset || !(asset in PROMPTS)) {
    return NextResponse.json(
      { error: `Invalid asset. Must be one of: ${Object.keys(PROMPTS).join(", ")}` },
      { status: 400 }
    );
  }

  const storagePath = `editor-assets/${asset}-${CUTOUT_STORAGE_VERSION}.png`;
  const bucket = "office-assets";
  const supabaseAdmin = getSupabaseAdmin();

  // ── Check cache in Supabase Storage (skip if force=true) ─────────────────
  if (!forceRegenerate) {
    const { data: existing } = await supabaseAdmin.storage.from(bucket).list("editor-assets", {
      search: `${asset}-${CUTOUT_STORAGE_VERSION}.png`,
      limit: 1,
    });
    if (existing && existing.length > 0) {
      const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
      return NextResponse.json({ asset, url: urlData.publicUrl, cached: true });
    }
  }

  // ── Generate base image via OpenRouter ────────────────────────────────────
  let buffer: Buffer;
  try {
    const ab = await generateImage(PROMPTS[asset]);
    buffer = Buffer.from(ab);
  } catch (err) {
    console.error("[generate-office-asset] Generation failed:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  // ── Mandatory cutout pass before publication ─────────────────────────────
  try {
    buffer = removeBackground(buffer);
  } catch (err) {
    const message = (err as Error).message;
    console.error("[generate-office-asset] Cutout failed:", message);
    return NextResponse.json({ error: `Cutout failed: ${message}` }, { status: 502 });
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    console.error("[generate-office-asset] Supabase upload error:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 502 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
  return NextResponse.json({ asset, url: urlData.publicUrl + `?t=${Date.now()}`, cached: false });
}

export async function DELETE() {
  const bucket = "office-assets";
  const supabaseAdmin = getSupabaseAdmin();

  const collectPaths = async (folder: string): Promise<string[] | null> => {
    const { data: files, error } = await supabaseAdmin.storage.from(bucket).list(folder, {
      limit: 200,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      return null;
    }

    return (files ?? [])
      .filter((file) => !!file.name && file.name !== ".emptyFolderPlaceholder")
      .map((file) => `${folder}/${file.name}`);
  };

  const editorPaths = await collectPaths("editor-assets");
  if (editorPaths === null) {
    return NextResponse.json({ error: "Unable to list editor-assets folder" }, { status: 502 });
  }

  const legacyPaths = await collectPaths("sprites");
  if (legacyPaths === null) {
    return NextResponse.json({ error: "Unable to list sprites folder" }, { status: 502 });
  }

  const paths = [...editorPaths, ...legacyPaths];

  if (paths.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No office assets found" });
  }

  const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths);
  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 502 });
  }

  return NextResponse.json({ deleted: paths.length, paths });
}
