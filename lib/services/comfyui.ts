/**
 * Image generation service.
 * - If SD_API_URL is set → uses Stable Diffusion WebUI (A1111) API (Cloudflare Tunnel or local)
 * - Otherwise → falls back to local ComfyUI (localhost:8188)
 */

// ── SD WebUI (A1111) ─────────────────────────────────────────────────────────
const SD_API_URL = process.env.SD_API_URL?.replace(/\/$/, "");
const SD_CHECKPOINT = process.env.SD_CHECKPOINT ?? process.env.COMFYUI_CHECKPOINT;
const SD_PIXEL_CHECKPOINT = process.env.SD_PIXEL_CHECKPOINT ?? process.env.COMFYUI_PIXEL_CHECKPOINT;

// ── ComfyUI (local fallback) ──────────────────────────────────────────────────
const COMFY_URL = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
const CHECKPOINT = process.env.COMFYUI_CHECKPOINT ?? "Realistic_Vision_V6.0_NV_B1.safetensors";
const PIXEL_CHECKPOINT = process.env.COMFYUI_PIXEL_CHECKPOINT ?? "pixnite15PurePixel_v10.safetensors";
const VAE_NAME = process.env.COMFYUI_VAE ?? "vae-ft-mse-840000-ema-pruned.safetensors";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // 3 min max

const DEFAULT_NEGATIVE =
  "ugly, deformed face, extra fingers, bad anatomy, blurry, low quality, watermark, text, cartoon, anime, CGI, 3D render, painting, illustration, nsfw, nudity";

const PIXEL_NEGATIVE =
  "blurry, low quality, watermark, text, photorealistic, 3D render, smooth shading, anti-aliased, gradient, noise";

export interface ComfyImageResult {
  buffer: Buffer;
  contentType: string;
}

export interface ComfyPortraitOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
}

export interface ComfyImg2ImgOptions extends ComfyPortraitOptions {
  initImageBuffer: Buffer;
  denoise?: number;
}

// ── Upload init image to ComfyUI temp folder ──────────────────────────────────
async function uploadInitImage(imageBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/png" });
  formData.append("image", blob, "init.png");
  formData.append("type", "input");
  formData.append("overwrite", "true");

  const res = await fetch(`${COMFY_URL}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ComfyUI /upload/image error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const filename: string | undefined = data?.name;
  if (!filename) throw new Error("ComfyUI upload returned no filename");
  return filename;
}

function buildPortraitWorkflow(opts: ComfyPortraitOptions): Record<string, unknown> {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);

  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CHECKPOINT } },
    "2": { class_type: "VAELoader", inputs: { vae_name: VAE_NAME } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: opts.prompt, clip: ["1", 1] } },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: opts.negativePrompt ?? DEFAULT_NEGATIVE, clip: ["1", 1] },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width: opts.width ?? 512, height: opts.height ?? 768, batch_size: 1 },
    },
    "6": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["3", 0],
        negative: ["4", 0],
        latent_image: ["5", 0],
        seed,
        steps: opts.steps ?? 25,
        cfg: opts.cfg ?? 7,
        sampler_name: "euler_ancestral",
        scheduler: "normal",
        denoise: 1,
      },
    },
    "7": { class_type: "VAEDecode", inputs: { samples: ["6", 0], vae: ["2", 0] } },
    "8": { class_type: "SaveImage", inputs: { images: ["7", 0], filename_prefix: "eden" } },
  };
}

// img2img: loads init image, encodes to latent, then KSampler with denoise < 1
function buildImg2ImgWorkflow(
  opts: ComfyPortraitOptions,
  initFilename: string,
  denoise: number
): Record<string, unknown> {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);

  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CHECKPOINT } },
    "2": { class_type: "VAELoader", inputs: { vae_name: VAE_NAME } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: opts.prompt, clip: ["1", 1] } },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: opts.negativePrompt ?? DEFAULT_NEGATIVE, clip: ["1", 1] },
    },
    "5": {
      class_type: "LoadImage",
      inputs: { image: initFilename },
    },
    "6": {
      class_type: "ImageScale",
      inputs: {
        image: ["5", 0],
        width: opts.width ?? 512,
        height: opts.height ?? 512,
        upscale_method: "lanczos",
        crop: "center",
      },
    },
    "7": { class_type: "VAEEncode", inputs: { pixels: ["6", 0], vae: ["2", 0] } },
    "8": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["3", 0],
        negative: ["4", 0],
        latent_image: ["7", 0],
        seed,
        steps: opts.steps ?? 25,
        cfg: opts.cfg ?? 7,
        sampler_name: "euler_ancestral",
        scheduler: "normal",
        denoise,
      },
    },
    "9": { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["2", 0] } },
    "10": { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: "eden_i2i" } },
  };
}

function buildPixelArtWorkflow(opts: ComfyPortraitOptions): Record<string, unknown> {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);

  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: PIXEL_CHECKPOINT } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: opts.prompt, clip: ["1", 1] } },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: opts.negativePrompt ?? PIXEL_NEGATIVE, clip: ["1", 1] },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width: opts.width ?? 512, height: opts.height ?? 512, batch_size: 1 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps: opts.steps ?? 20,
        cfg: opts.cfg ?? 7,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1,
      },
    },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "eden_pixel" } },
  };
}

async function queuePrompt(workflow: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ComfyUI /prompt error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const promptId: string | undefined = data?.prompt_id;
  if (!promptId) throw new Error("ComfyUI returned no prompt_id");
  return promptId;
}

async function waitForResult(promptId: string): Promise<{ filename: string; subfolder: string }> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!res.ok) continue;

    const history = await res.json();
    const entry = history?.[promptId];
    if (!entry) continue;

    if (entry.status?.status_str === "error") {
      throw new Error(`ComfyUI job failed: ${JSON.stringify(entry.status)}`);
    }

    const outputs = entry?.outputs;
    if (!outputs) continue;

    for (const nodeOutput of Object.values(outputs) as Array<{ images?: Array<{ filename: string; subfolder: string }> }>) {
      const images = nodeOutput?.images;
      if (Array.isArray(images) && images.length > 0) {
        return { filename: images[0].filename, subfolder: images[0].subfolder ?? "" };
      }
    }
  }

  throw new Error("ComfyUI job timed out after 3 minutes");
}

async function fetchOutputImage(filename: string, subfolder: string): Promise<ComfyImageResult> {
  const url = new URL(`${COMFY_URL}/view`);
  url.searchParams.set("filename", filename);
  url.searchParams.set("subfolder", subfolder);
  url.searchParams.set("type", "output");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ComfyUI /view error ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/png";

  return { buffer: Buffer.from(arrayBuffer), contentType: contentType.split(";")[0].trim() };
}

// ── SD WebUI (A1111) helpers ──────────────────────────────────────────────────

async function sdTxt2Img(
  opts: ComfyPortraitOptions,
  overrideCheckpoint?: string
): Promise<ComfyImageResult> {
  const url = `${SD_API_URL}/sdapi/v1/txt2img`;
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    negative_prompt: opts.negativePrompt ?? DEFAULT_NEGATIVE,
    width: opts.width ?? 512,
    height: opts.height ?? 768,
    steps: opts.steps ?? 25,
    cfg_scale: opts.cfg ?? 7,
    sampler_name: "Euler a",
    seed: opts.seed ?? -1,
    batch_size: 1,
  };
  if (overrideCheckpoint) {
    body.override_settings = { sd_model_checkpoint: overrideCheckpoint };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SD WebUI txt2img error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const base64: string | undefined = data?.images?.[0];
  if (!base64) throw new Error("SD WebUI returned no image");
  return { buffer: Buffer.from(base64, "base64"), contentType: "image/png" };
}

async function sdImg2Img(opts: ComfyImg2ImgOptions): Promise<ComfyImageResult> {
  const url = `${SD_API_URL}/sdapi/v1/img2img`;
  const body: Record<string, unknown> = {
    init_images: [opts.initImageBuffer.toString("base64")],
    prompt: opts.prompt,
    negative_prompt: opts.negativePrompt ?? DEFAULT_NEGATIVE,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
    steps: opts.steps ?? 25,
    cfg_scale: opts.cfg ?? 7,
    sampler_name: "Euler a",
    seed: opts.seed ?? -1,
    denoising_strength: opts.denoise ?? 0.55,
    batch_size: 1,
  };
  if (SD_CHECKPOINT) {
    body.override_settings = { sd_model_checkpoint: SD_CHECKPOINT };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SD WebUI img2img error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const base64: string | undefined = data?.images?.[0];
  if (!base64) throw new Error("SD WebUI img2img returned no image");
  return { buffer: Buffer.from(base64, "base64"), contentType: "image/png" };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateImageLocally(opts: ComfyPortraitOptions): Promise<ComfyImageResult> {
  if (SD_API_URL) return sdTxt2Img(opts, SD_CHECKPOINT);
  const workflow = buildPortraitWorkflow(opts);
  const promptId = await queuePrompt(workflow);
  const { filename, subfolder } = await waitForResult(promptId);
  return fetchOutputImage(filename, subfolder);
}

export async function generateImg2ImgLocally(opts: ComfyImg2ImgOptions): Promise<ComfyImageResult> {
  if (SD_API_URL) return sdImg2Img(opts);
  const denoise = opts.denoise ?? 0.55;
  const initFilename = await uploadInitImage(opts.initImageBuffer);
  const workflow = buildImg2ImgWorkflow(opts, initFilename, denoise);
  const promptId = await queuePrompt(workflow);
  const { filename, subfolder } = await waitForResult(promptId);
  return fetchOutputImage(filename, subfolder);
}

export async function generatePixelArtLocally(opts: ComfyPortraitOptions): Promise<ComfyImageResult> {
  if (SD_API_URL) return sdTxt2Img({ ...opts, negativePrompt: opts.negativePrompt ?? PIXEL_NEGATIVE }, SD_PIXEL_CHECKPOINT);
  const workflow = buildPixelArtWorkflow(opts);
  const promptId = await queuePrompt(workflow);
  const { filename, subfolder } = await waitForResult(promptId);
  return fetchOutputImage(filename, subfolder);
}
