import { NextResponse } from "next/server";
import { getConventions, setConventions, setSetting } from "@/lib/services/studioSettingsService";

export async function GET() {
  try {
    const conventions = await getConventions();
    return NextResponse.json({ conventions });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const conventions = typeof body.conventions === "string" ? body.conventions : "";
    await setConventions(conventions);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { key, value } = body as { key: string; value: string };
    if (!key || typeof value !== "string") {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }
    await setSetting(key, value);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
