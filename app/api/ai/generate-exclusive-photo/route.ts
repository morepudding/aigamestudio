import { NextRequest, NextResponse } from "next/server";
import { Civitai } from "civitai";
import { getAgentBySlug } from "@/lib/services/agentService";
import { supabase } from "@/lib/supabase/client";
import { getExclusiveTierByThreshold } from "@/lib/config/exclusivePhotos";

const DEFAULT_CIVITAI_MODEL_URN = "urn:air:sd1:checkpoint:civitai:4201@130072";
const DEFAULT_NEGATIVE_PROMPT =
  "low quality, blurry, deformed face, deformed body, extra fingers, bad anatomy, cartoon, anime, cgi, explicit nudity, fetish, watermark, text";

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeContentType(contentType: string | null): string {
  if (!contentType) return "image/png";
  return contentType.split(";")[0]?.trim() || "image/png";
}

function extractBlobUrl(payload: unknown): string | null {
  const jobs = (payload as { jobs?: Array<{ result?: { available?: boolean; blobUrl?: string } }> })?.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) return null;

  const ready = jobs.find((job) => job?.result?.available && typeof job?.result?.blobUrl === "string");
  if (ready?.result?.blobUrl) return ready.result.blobUrl;

  const fallback = jobs.find((job) => typeof job?.result?.blobUrl === "string");
  return fallback?.result?.blobUrl ?? null;
}

async function fetchImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    const body = await imageRes.text();
    throw new Error(`Civitai image download failed (${imageRes.status}): ${body}`);
  }

  const arrayBuffer = await imageRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: normalizeContentType(imageRes.headers.get("content-type")),
  };
}

async function generateImageWithCivitai(
  apiToken: string,
  prompt: string,
  referenceImageUrl?: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const civitai = new Civitai({ auth: apiToken });
  const model = process.env.CIVITAI_EXCLUSIVE_MODEL_URN || DEFAULT_CIVITAI_MODEL_URN;

  const fullPrompt = [
    prompt,
    referenceImageUrl ? `Reference portrait URL for identity consistency: ${referenceImageUrl}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const input = {
    model,
    params: {
      prompt: fullPrompt,
      negativePrompt: process.env.CIVITAI_EXCLUSIVE_NEGATIVE_PROMPT || DEFAULT_NEGATIVE_PROMPT,
      scheduler: "EulerA",
      steps: parseIntEnv("CIVITAI_EXCLUSIVE_STEPS", 28),
      cfgScale: parseIntEnv("CIVITAI_EXCLUSIVE_CFG", 7),
      width: parseIntEnv("CIVITAI_EXCLUSIVE_WIDTH", 768),
      height: parseIntEnv("CIVITAI_EXCLUSIVE_HEIGHT", 1024),
    },
  };

  const initial = await civitai.image.fromText(input, true);
  let blobUrl = extractBlobUrl(initial);

  if (!blobUrl && typeof (initial as { token?: unknown })?.token === "string") {
    const polled = await civitai.jobs.getByToken((initial as { token: string }).token);
    blobUrl = extractBlobUrl(polled);
  }

  if (!blobUrl) throw new Error("Civitai returned no generated image URL.");

  return fetchImageBuffer(blobUrl);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawSlug = typeof body?.slug === "string" ? body.slug : "";
  const threshold = Number(body?.threshold);

  const safeSlug = rawSlug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug || !Number.isFinite(threshold)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const tier = getExclusiveTierByThreshold(threshold);
  if (!tier) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }

  const apiToken = process.env.CIVITAI_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json(
      { error: "Civitai API token non configure (CIVITAI_API_TOKEN manquant)." },
      { status: 500 }
    );
  }

  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const confidenceLevel = agent.confidence_level ?? 0;
  if (confidenceLevel < threshold) {
    return NextResponse.json({ error: "Tier locked", needed: threshold, current: confidenceLevel }, { status: 403 });
  }

  const genderWord = agent.gender === "femme" ? "woman" : "man";
  const appearance = agent.appearance_prompt ?? "";
  const role = agent.role ?? "";
  const referenceImageUrl = agent.icon_url ?? agent.portrait_url ?? undefined;

  const prompt = [
    `Hyperrealistic editorial photo of an attractive ${genderWord}.`,
    appearance ? `Appearance: ${appearance}.` : "",
    role ? `Works as ${role}.` : "",
    `Style direction: ${tier.stylePrompt}.`,
    "Preserve facial identity and hairstyle from the reference image.",
    "Fashion photography quality, clean skin texture, natural proportions, sharp focus, cinematic depth.",
    "Strict safety: no nudity, no explicit sexual content, no fetish framing, no minors.",
    "NOT distorted face, NOT deformed body, NOT anime, NOT cartoon, NOT CGI, NOT painting.",
  ]
    .filter(Boolean)
    .join(" ");

  const fallbackSafePrompt = [
    `Hyperrealistic professional portrait of a ${genderWord}.`,
    appearance ? `Appearance: ${appearance}.` : "",
    role ? `Works as ${role}.` : "",
    "Style direction: premium fashion editorial, neutral elegant interior, natural pose, cinematic light.",
    "Preserve facial identity and hairstyle from the reference image.",
    "Strict safety: fully clothed, no nudity, no explicit sexual content, no fetish framing, no minors.",
    "NOT distorted face, NOT deformed body, NOT anime, NOT cartoon, NOT CGI, NOT painting.",
  ]
    .filter(Boolean)
    .join(" ");

  let imagePayload: { buffer: Buffer; contentType: string };
  try {
    imagePayload = await generateImageWithCivitai(apiToken, prompt, referenceImageUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";

    try {
      imagePayload = await generateImageWithCivitai(apiToken, fallbackSafePrompt, referenceImageUrl);
    } catch (retryErr) {
      const retryMessage = retryErr instanceof Error ? retryErr.message : "Image generation failed";
      return NextResponse.json(
        {
          error: "La generation Civitai a echoue. Reessaie dans quelques secondes.",
          details: `${message} | Retry: ${retryMessage}`,
        },
        { status: 502 }
      );
    }
  }

  const bucket = "agent-avatars";
  const storagePath = `${safeSlug}/exclusive-${threshold}.png`;

  await supabase.storage.from(bucket).remove([storagePath]);

  const upload = await supabase.storage.from(bucket).upload(storagePath, imagePayload.buffer, {
    contentType: imagePayload.contentType,
    upsert: true,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 502 });
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
  const cacheBuster = `?t=${Date.now()}`;

  return NextResponse.json({
    imageUrl: `${publicUrl}${cacheBuster}`,
    threshold,
    title: tier.title,
  });
}
