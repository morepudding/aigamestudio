import { NextRequest, NextResponse } from "next/server";
import {
  getConventions,
  setConventions,
  getUniverseLore,
  setUniverseLore,
} from "@/lib/services/studioSettingsService";

// GET /api/settings
export async function GET() {
  const [conventions, universeLore] = await Promise.all([
    getConventions(),
    getUniverseLore(),
  ]);
  return NextResponse.json({ conventions, universeLore });
}

// PATCH /api/settings
// Body: { conventions?: string, universeLore?: string }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { conventions?: string; universeLore?: string };

  await Promise.all([
    body.conventions !== undefined ? setConventions(body.conventions) : Promise.resolve(),
    body.universeLore !== undefined ? setUniverseLore(body.universeLore) : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
