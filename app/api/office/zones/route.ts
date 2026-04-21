import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OfficeZone, ZoneCreatePayload } from "@/lib/types/office";

// office_zones is not represented in generated DB types here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseAdminClient() as any; }

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const id = params.get("id");
    const department = params.get("department");
    const agentSlug = params.get("agentSlug");
    const commonOnly = params.get("commonOnly") === "true";
    const activeOnly = params.get("activeOnly") !== "false";

    let query = db().from("office_zones").select("*");

    if (id) {
      query = query.eq("id", id);
    }

    if (department) {
      query = query.eq("department", department);
    }

    if (agentSlug) {
      query = query.eq("agent_slug", agentSlug);
    }

    if (commonOnly) {
      query = query.is("department", null).is("agent_slug", null);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    query = query.order("created_at", { ascending: false });

    if (id) {
      const { data, error } = await query.maybeSingle();
      if (error) {
        return jsonError(error.message, 500, error);
      }

      return NextResponse.json({ zone: (data ?? null) as OfficeZone | null });
    }

    const { data, error } = await query;
    if (error) {
      return jsonError(error.message, 500, error);
    }

    return NextResponse.json({ zones: (data ?? []) as OfficeZone[] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ZoneCreatePayload;

    const zoneData = {
      ...payload,
      color: payload.color ?? "#3b82f6",
      opacity: payload.opacity ?? 0.2,
      zone_type: payload.zone_type ?? "common",
      is_active: payload.is_active ?? true,
      is_exclusive: payload.is_exclusive ?? true,
      allow_crossing: payload.allow_crossing ?? true,
    };

    const { error: deactivateError } = await db()
      .from("office_zones")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      return jsonError(deactivateError.message, 500, deactivateError);
    }

    const { data, error } = await db()
      .from("office_zones")
      .insert([zoneData])
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500, error);
    }

    return NextResponse.json({ zone: data as OfficeZone }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unknown error");
  }
}