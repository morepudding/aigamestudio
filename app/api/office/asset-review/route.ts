import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AssetVariant, OfficeAssetType } from "@/lib/services/officeAssetService";
import type { ReviewStatus } from "@/lib/config/officeAssetReview";

type ReviewRow = {
  module_key: string;
  asset_type: OfficeAssetType;
  variant: AssetVariant;
  attempt: number;
  review_status: ReviewStatus;
  raw_url: string;
  approved_url: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewPayload = {
  moduleKey: string;
  assetType: OfficeAssetType;
  variant: AssetVariant;
  attempt: number;
  rawUrl: string;
  decision: ReviewStatus;
};

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars for asset review route");
  }

  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

// office_asset_reviews is not in the generated Supabase types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseAdmin() as any; }

export async function GET() {
  try {
    const { data, error } = await db()
      .from("office_asset_reviews")
      .select("module_key,asset_type,variant,attempt,review_status,raw_url,approved_url,reviewed_at,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: (data ?? []) as ReviewRow[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as ReviewPayload;

    if (!body.moduleKey || !body.assetType || !body.rawUrl) {
      return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
    }

    if (![1, 2, 3, 4].includes(body.variant) || ![1, 2, 3, 4, 5, 6, 7, 8].includes(body.attempt)) {
      return NextResponse.json({ error: "Invalid variant or attempt" }, { status: 400 });
    }

    if (!["raw", "approved", "rejected"].includes(body.decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    if (body.decision === "raw") {
      const { error } = await db()
        .from("office_asset_reviews")
        .delete()
        .eq("asset_type", body.assetType)
        .eq("variant", body.variant)
        .eq("attempt", body.attempt);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, decision: "raw" });
    }

    if (body.decision === "approved") {
      const { error: demoteError } = await db()
        .from("office_asset_reviews")
        .update({
          review_status: "rejected",
          approved_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("asset_type", body.assetType)
        .eq("variant", body.variant)
        .eq("review_status", "approved")
        .neq("attempt", body.attempt);

      if (demoteError) {
        return NextResponse.json({ error: demoteError.message }, { status: 500 });
      }
    }

    const approvedUrl = body.decision === "approved"
      ? body.rawUrl.split("?")[0]
      : null;

    const payload = {
      module_key: body.moduleKey,
      asset_type: body.assetType,
      variant: body.variant,
      attempt: body.attempt,
      review_status: body.decision,
      raw_url: body.rawUrl.split("?")[0],
      approved_url: approvedUrl,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await db().from("office_asset_reviews").upsert(payload, {
      onConflict: "asset_type,variant,attempt",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}