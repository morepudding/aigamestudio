import { createClient } from "@supabase/supabase-js";

// ============================================================
// Screenshot service
// Capture une page web via Playwright headless et upload
// le PNG dans Supabase Storage (bucket "wave-screenshots").
// ============================================================

const BUCKET = "wave-screenshots";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Service role key pour uploader sans RLS
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/**
 * Prend un screenshot de l'URL donnée et l'uploade dans Supabase Storage.
 * Retourne l'URL publique du screenshot.
 *
 * Utilise @sparticuz/chromium pour tourner en environnement serverless (Next.js API route).
 */
export async function captureScreenshot(
  pageUrl: string,
  storagePath: string
): Promise<string> {
  // Import dynamique pour éviter des erreurs de build côté client
  const chromium = (await import("@sparticuz/chromium")).default;
  const { chromium: playwrightChromium } = await import("playwright-core");

  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  let screenshotBuffer: Buffer;

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });

    // Timeout généreux pour les Pages qui peuvent être lentes à charger
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30_000 });

    // Attendre 1s supplémentaire pour les animations d'entrée
    await page.waitForTimeout(1000);

    screenshotBuffer = Buffer.from(await page.screenshot({ type: "png", fullPage: false }));
  } finally {
    await browser.close();
  }

  // Upload dans Supabase Storage
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, screenshotBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(`Screenshot upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Génère un chemin de stockage canonique pour un screenshot de wave.
 * ex: "projects/proj-abc/wave-2/screenshot-1713456789.png"
 */
export function waveScreenshotPath(projectId: string, waveNumber: number): string {
  return `projects/${projectId}/wave-${waveNumber}/screenshot-${Date.now()}.png`;
}
