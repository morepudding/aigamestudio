import { NextRequest, NextResponse } from "next/server";
import { getAgentBySlug, updateAgentFields } from "@/lib/services/agentService";
import { supabase } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawSlug = typeof body?.slug === "string" ? body.slug : "";
  const target =
    body?.target === "portrait" || body?.target === "icon" || body?.target === "both"
      ? body.target
      : "both";
  const safeSlug = rawSlug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  // ── Load agent from DB ────────────────────────────────
  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const appearance = agent.appearance_prompt ?? "";
  const role = agent.role ?? "";
  const gender = agent.gender ?? "";
  const genderWord = gender === "femme" ? "woman" : "man";
  const genderPrompt = gender === "femme" ? "adult woman" : "adult man";
  const antiWrongGenderPrompt =
    gender === "femme"
      ? "NOT male, NOT man, NOT beard, NOT moustache, NOT masculine face."
      : "NOT female, NOT woman, NOT feminine face.";

  const attractivenessPrompt =
    gender === "femme"
      ? "beautiful, attractive, elegant, subtly sensual, expressive eyes, perfect skin, photogenic."
      : "handsome, attractive, strong jaw, charismatic, expressive eyes, perfect skin, photogenic.";

  const portraitPrompt = [
    `Photorealistic profile portrait of an ${genderPrompt}.`,
    `Subject gender must be ${genderWord}.`,
    appearance ? `Appearance: ${appearance}.` : "",
    role ? `Works as ${role}.` : "",
    attractivenessPrompt,
    "Head and shoulders framing, realistic skin, cinematic natural lighting, dark moody neutral background, sharp detailed eyes, confident subtle expression, professional editorial style.",
    antiWrongGenderPrompt,
    "NOT anime, NOT cartoon, NOT illustration, NOT CGI, NOT 3D render, NOT painting, NOT deformed face.",
  ]
    .filter(Boolean)
    .join(" ");

  const iconPrompt = [
    `Photorealistic close-up profile photo of an ${genderPrompt}.`,
    `Subject gender must be ${genderWord}.`,
    appearance ? `Appearance: ${appearance}.` : "",
    attractivenessPrompt,
    "Tight face crop for avatar usage, cinematic natural lighting, clean neutral background, realistic skin texture, sharp eyes, confident expression.",
    antiWrongGenderPrompt,
    "NOT anime, NOT cartoon, NOT illustration, NOT CGI, NOT 3D render, NOT painting, NOT deformed face.",
  ]
    .filter(Boolean)
    .join(" ");

  // ── Call OpenRouter image generation ─────────────────
  async function generateImage(prompt: string, referenceImageUrl?: string): Promise<string> {
    const content: unknown = referenceImageUrl
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: referenceImageUrl } },
        ]
      : prompt;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aigamestudio.local",
        "X-Title": "AI Game Studio",
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux.2-klein-4b",
        messages: [{ role: "user", content }],
        modalities: ["image"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const imageUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("No image in OpenRouter response");
    return imageUrl;
  }

  let portraitDataUrl: string | null = null;
  let iconDataUrl: string | null = null;
  try {
    // Generate portrait first so it can serve as reference for the icon
    if (target !== "icon") {
      portraitDataUrl = await generateImage(portraitPrompt);
    }

    if (target !== "portrait") {
      // Use the freshly generated portrait, or the existing one from DB, as reference
      const portraitRef = portraitDataUrl ?? agent.portrait_url ?? undefined;
      iconDataUrl = await generateImage(iconPrompt, portraitRef);
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  function dataUrlToBuffer(dataUrl: string): Buffer {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64, "base64");
  }

  const bucket = "agent-avatars";
  const portraitPath = `${safeSlug}/portrait.png`;
  const iconPath = `${safeSlug}/icon.png`;

  // Delete existing files first to bust CDN cache
  const pathsToDelete: string[] = [];
  if (target !== "icon" && portraitDataUrl) pathsToDelete.push(portraitPath);
  if (target !== "portrait" && iconDataUrl) pathsToDelete.push(iconPath);
  if (pathsToDelete.length > 0) {
    await supabase.storage.from(bucket).remove(pathsToDelete);
  }

  const [portraitUpload, iconUpload] = await Promise.all([
    portraitDataUrl
      ? supabase.storage.from(bucket).upload(portraitPath, dataUrlToBuffer(portraitDataUrl), {
          contentType: "image/png",
          upsert: true,
        })
      : Promise.resolve({ error: null }),
    iconDataUrl
      ? supabase.storage.from(bucket).upload(iconPath, dataUrlToBuffer(iconDataUrl), {
          contentType: "image/png",
          upsert: true,
        })
      : Promise.resolve({ error: null }),
  ]);

  if (portraitUpload.error || iconUpload.error) {
    return NextResponse.json(
      { error: portraitUpload.error?.message ?? iconUpload.error?.message },
      { status: 502 }
    );
  }

  const cacheBuster = `?t=${Date.now()}`;
  const portraitUrl = portraitDataUrl
    ? supabase.storage.from(bucket).getPublicUrl(portraitPath).data.publicUrl
    : agent.portrait_url;
  const iconUrl = iconDataUrl
    ? supabase.storage.from(bucket).getPublicUrl(iconPath).data.publicUrl
    : agent.icon_url;

  // Update URLs in DB (without cache buster to avoid stacking query params)
  await updateAgentFields(safeSlug, {
    ...(portraitDataUrl ? { portrait_url: portraitUrl } : {}),
    ...(iconDataUrl ? { icon_url: iconUrl } : {}),
  });

  return NextResponse.json({
    portrait: portraitUrl ? portraitUrl + cacheBuster : portraitUrl,
    icon: iconUrl ? iconUrl + cacheBuster : iconUrl,
    target,
  });
}
