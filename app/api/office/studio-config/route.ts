import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { OfficeAssetType } from "@/lib/services/officeAssetService";

const OFFICE_DEFAULT_ASSETS_KEY = "office_default_asset_urls_v1";
const OFFICE_LAYOUT_KEY = "office_studio_layout_v1";

type StudioLayoutAsset = {
  type: OfficeAssetType;
  sourceUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type StudioLayout = {
  canvas: {
    width: number;
    height: number;
  };
  studioAssetUrl: string;
  assets: StudioLayoutAsset[];
};

type Payload =
  | {
      kind: "default-asset";
      assetType: OfficeAssetType;
      url: string;
    }
  | {
      kind: "layout";
      layout: StudioLayout;
    };

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars for studio config route");
  }

  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("studio_settings")
      .select("key,value")
      .in("key", [OFFICE_DEFAULT_ASSETS_KEY, OFFICE_LAYOUT_KEY]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as { key: string; value: string }[];
    const defaultAssetsRaw = rows.find((row) => row.key === OFFICE_DEFAULT_ASSETS_KEY)?.value;
    const layoutRaw = rows.find((row) => row.key === OFFICE_LAYOUT_KEY)?.value;

    const defaultAssets = parseJsonSafe<Partial<Record<OfficeAssetType, string>>>(defaultAssetsRaw, {});
    const layout = parseJsonSafe<StudioLayout | null>(layoutRaw, null);

    return NextResponse.json({ defaultAssets, layout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    const supabaseAdmin = getSupabaseAdmin();

    if (body.kind === "default-asset") {
      if (!body.url || typeof body.url !== "string") {
        return NextResponse.json({ error: "Invalid asset URL" }, { status: 400 });
      }

      const { data: existing, error: getError } = await supabaseAdmin
        .from("studio_settings")
        .select("value")
        .eq("key", OFFICE_DEFAULT_ASSETS_KEY)
        .maybeSingle();

      if (getError) {
        return NextResponse.json({ error: getError.message }, { status: 500 });
      }

      const existingRow = existing as { value: string } | null;
      const defaults = parseJsonSafe<Partial<Record<OfficeAssetType, string>>>(existingRow?.value, {});
      defaults[body.assetType] = body.url;

      const { error: saveError } = await supabaseAdmin.from("studio_settings").upsert(
        { key: OFFICE_DEFAULT_ASSETS_KEY, value: JSON.stringify(defaults), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      if (saveError) {
        return NextResponse.json({ error: saveError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, defaultAssets: defaults });
    }

    if (body.kind === "layout") {
      if (!body.layout?.studioAssetUrl || !Array.isArray(body.layout.assets)) {
        return NextResponse.json({ error: "Invalid layout payload" }, { status: 400 });
      }

      const { error: saveError } = await supabaseAdmin.from("studio_settings").upsert(
        { key: OFFICE_LAYOUT_KEY, value: JSON.stringify(body.layout), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      if (saveError) {
        return NextResponse.json({ error: saveError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid request kind" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
