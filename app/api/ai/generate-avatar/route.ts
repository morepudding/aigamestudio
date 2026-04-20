import { NextRequest, NextResponse } from "next/server";
import { getAgentBySlug, updateAgentFields } from "@/lib/services/agentService";
import { supabase } from "@/lib/supabase/client";
import { generateImageLocally, generateImg2ImgLocally } from "@/lib/services/comfyui";

export const maxDuration = 120;

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

  // ── Generate via ComfyUI (local) ──────────────────────
  let portraitBuffer: Buffer | null = null;
  let iconBuffer: Buffer | null = null;
  try {
    if (target !== "icon") {
      const result = await generateImageLocally({ prompt: portraitPrompt, width: 512, height: 768 });
      portraitBuffer = result.buffer;
    }
    if (target !== "portrait") {
      // Use portrait as init image for face consistency (img2img, denoise 0.55)
      let initBuffer: Buffer | null = portraitBuffer;
      if (!initBuffer && agent.portrait_url) {
        const res = await fetch(agent.portrait_url);
        initBuffer = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
      }

      if (initBuffer) {
        const result = await generateImg2ImgLocally({
          prompt: iconPrompt,
          initImageBuffer: initBuffer,
          width: 512,
          height: 512,
          denoise: 0.55,
        });
        iconBuffer = result.buffer;
      } else {
        const result = await generateImageLocally({ prompt: iconPrompt, width: 512, height: 512 });
        iconBuffer = result.buffer;
      }
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  // ── Upload to Supabase Storage ────────────────────────
  const bucket = "agent-avatars";
  const portraitPath = `${safeSlug}/portrait.png`;
  const iconPath = `${safeSlug}/icon.png`;

  const pathsToDelete: string[] = [];
  if (target !== "icon" && portraitBuffer) pathsToDelete.push(portraitPath);
  if (target !== "portrait" && iconBuffer) pathsToDelete.push(iconPath);
  if (pathsToDelete.length > 0) {
    await supabase.storage.from(bucket).remove(pathsToDelete);
  }

  const [portraitUpload, iconUpload] = await Promise.all([
    portraitBuffer
      ? supabase.storage.from(bucket).upload(portraitPath, portraitBuffer, {
          contentType: "image/png",
          upsert: true,
        })
      : Promise.resolve({ error: null }),
    iconBuffer
      ? supabase.storage.from(bucket).upload(iconPath, iconBuffer, {
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
  const portraitUrl = portraitBuffer
    ? supabase.storage.from(bucket).getPublicUrl(portraitPath).data.publicUrl
    : agent.portrait_url;
  const iconUrl = iconBuffer
    ? supabase.storage.from(bucket).getPublicUrl(iconPath).data.publicUrl
    : agent.icon_url;

  await updateAgentFields(safeSlug, {
    ...(portraitBuffer ? { portrait_url: portraitUrl } : {}),
    ...(iconBuffer ? { icon_url: iconUrl } : {}),
  });

  return NextResponse.json({
    portrait: portraitUrl ? portraitUrl + cacheBuster : portraitUrl,
    icon: iconUrl ? iconUrl + cacheBuster : iconUrl,
    target,
  });
}
