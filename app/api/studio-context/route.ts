import { NextResponse } from "next/server";
import { buildStudioContext } from "@/lib/services/studioContextService";

export async function GET() {
  try {
    const ctx = await buildStudioContext();
    return NextResponse.json(ctx);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
