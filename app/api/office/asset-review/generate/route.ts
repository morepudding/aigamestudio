import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OFFICE_REVIEW_MODULES } from "@/lib/config/officeAssetReview";

export const maxDuration = 300;

type GenerationPayload = {
  moduleKey?: string;
  attempts?: number;
  force?: boolean;
};

type GenerationResult = {
  moduleKey: string;
  moduleLabel: string;
  generated: number;
  skipped: number;
  notes: string[];
  errors: string[];
};

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars for asset review generation route");
  }

  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

// office_asset_reviews is not in the generated Supabase types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseAdmin() as any; }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as GenerationPayload;
    const attempts = Math.max(1, Math.min(8, body.attempts ?? 4));
    const force = body.force !== false;
    const selectedModules = body.moduleKey && body.moduleKey !== "all"
      ? OFFICE_REVIEW_MODULES.filter((moduleDef) => moduleDef.key === body.moduleKey)
      : OFFICE_REVIEW_MODULES;

    if (selectedModules.length === 0) {
      return NextResponse.json({ error: "Unknown moduleKey" }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const results: GenerationResult[] = [];

    for (const moduleDef of selectedModules) {
      if (moduleDef.targets.length === 0) {
        results.push({
          moduleKey: moduleDef.key,
          moduleLabel: moduleDef.label,
          generated: 0,
          skipped: 1,
          notes: [],
          errors: ["Module non branche au generateur"],
        });
        continue;
      }

      let generated = 0;
      let skipped = 0;
      const notes: string[] = [];
      const errors: string[] = [];

      for (const target of moduleDef.targets) {
        if (!force) {
          const { data: approvedRows, error: approvedError } = await db()
            .from("office_asset_reviews")
            .select("attempt")
            .eq("asset_type", target.assetType)
            .eq("variant", target.variant)
            .eq("review_status", "approved")
            .limit(1);

          if (approvedError) {
            errors.push(`${target.assetType} v${target.variant}: ${approvedError.message}`);
            continue;
          }

          if ((approvedRows ?? []).length > 0) {
            skipped += attempts;
            notes.push(`${target.assetType} ${target.variant}: angle deja approuve, generation sautee`);
            continue;
          }
        }

        for (let attempt = 1; attempt <= attempts; attempt++) {
          const response = await fetch(`${origin}/api/ai/generate-office-asset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              asset: target.assetType,
              variant: target.variant,
              attempt,
              force,
              use_v1_init: target.variant !== 1,
            }),
          });

          const data = await response.json().catch(() => ({})) as { cached?: boolean; error?: string };
          if (!response.ok) {
            errors.push(`${target.assetType} v${target.variant} a${attempt}: ${data.error ?? "Erreur inconnue"}`);
            continue;
          }

          if (data.cached) {
            skipped += 1;
          } else {
            generated += 1;
          }
        }
      }

      results.push({
        moduleKey: moduleDef.key,
        moduleLabel: moduleDef.label,
        generated,
        skipped,
        notes,
        errors,
      });
    }

    return NextResponse.json({
      ok: true,
      attempts,
      force,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}