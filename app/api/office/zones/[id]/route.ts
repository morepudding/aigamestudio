import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OfficeZone, ZoneUpdatePayload } from "@/lib/types/office";

// office_zones is not represented in generated DB types here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseAdminClient() as any; }

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error } = await db().from("office_zones").select("*").eq("id", id).maybeSingle();

    if (error) {
      return jsonError(error.message, 500, error);
    }

    return NextResponse.json({ zone: (data ?? null) as OfficeZone | null });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = (await req.json()) as Omit<ZoneUpdatePayload, "id">;

    const { data, error } = await db()
      .from("office_zones")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return jsonError(error.message, 500, error);
    }

    return NextResponse.json({ zone: data as OfficeZone });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { error } = await db().from("office_zones").update({ is_active: false }).eq("id", id);

    if (error) {
      return jsonError(error.message, 500, error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unknown error");
  }
}