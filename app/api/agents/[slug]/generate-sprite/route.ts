import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getAgentBySlug, updateAgentFields } from "@/lib/services/agentService";
import { getLpcLayersForAgent } from "@/lib/config/lpcMapping";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "agent-avatars";
const FRAME_SIZE = 64; // LPC base tile = 64×64 px
const FRAMES = 9;      // frames per row
const ROWS = 4;        // N W S E

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { layers, width, height } = getLpcLayersForAgent(
    safeSlug,
    agent.gender,
    agent.department,
    agent.appearance_prompt ?? ""
  );

  // Fetch all layers concurrently; skip any that return non-200
  const buffers = await Promise.all(
    layers.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      } catch {
        return null;
      }
    })
  );

  const validBuffers = buffers.filter((b): b is Buffer<ArrayBuffer> => b !== null);
  if (validBuffers.length === 0) {
    return NextResponse.json({ error: "No LPC layers could be fetched" }, { status: 502 });
  }

  // Composite all layers onto a transparent base
  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composite = validBuffers.map((input) => ({ input }));
  const composited = await base.composite(composite).png().toBuffer();

  // Also produce a small thumbnail (1 frame — south-facing idle, row 2 col 0)
  const thumbSize = FRAME_SIZE * 2; // 128 px, looks crisp at display size
  const thumbBuffer = await sharp(composited)
    .extract({ left: 0, top: FRAME_SIZE * 2, width: FRAME_SIZE, height: FRAME_SIZE })
    .resize(thumbSize, thumbSize, { kernel: "nearest" }) // nearest-neighbor keeps pixel look
    .png()
    .toBuffer();

  // Upload full spritesheet
  const spritePath = `${safeSlug}/lpc_sprite.png`;
  await supabase.storage.from(BUCKET).remove([spritePath]);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(spritePath, composited, { contentType: "image/png", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 502 });
  }

  // Upload thumbnail
  const thumbPath = `${safeSlug}/lpc_thumb.png`;
  await supabase.storage.from(BUCKET).remove([thumbPath]);
  await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumbBuffer, { contentType: "image/png", upsert: true });

  const spriteUrl = supabase.storage.from(BUCKET).getPublicUrl(spritePath).data.publicUrl;

  await updateAgentFields(safeSlug, { lpc_sprite_url: spriteUrl });

  return NextResponse.json({
    sprite_url: spriteUrl,
    layers_used: validBuffers.length,
    layers_total: layers.length,
    width: FRAMES * FRAME_SIZE,
    height: ROWS * FRAME_SIZE,
  });
}
