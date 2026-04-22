import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OFFICE_LAYOUT_KEY = "office_studio_layout_v1";

type StudioLayoutAsset = {
  id?: string;
  type: string;
  sourceUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variant?: number;
};

type StudioLayout = {
  canvas: {
    width: number;
    height: number;
  };
  studioAssetUrl: string;
  officeAgentScale?: number;
  assets: StudioLayoutAsset[];
};

type Payload = {
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

// studio_settings is not in the generated Supabase types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseAdmin() as any; }

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
    const { data, error } = await db()
      .from("studio_settings")
      .select("key,value")
      .eq("key", OFFICE_LAYOUT_KEY)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = data as { key: string; value: string } | null;
    const layout = parseJsonSafe<StudioLayout | null>(row?.value, null);

    return NextResponse.json({ layout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;

    if (body.kind !== "layout" || !body.layout?.studioAssetUrl || !Array.isArray(body.layout.assets)) {
      return NextResponse.json({ error: "Invalid layout payload" }, { status: 400 });
    }

    const { error: saveError } = await db().from("studio_settings").upsert(
      { key: OFFICE_LAYOUT_KEY, value: JSON.stringify(body.layout), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
