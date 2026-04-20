import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { cardId, accepted } = await req.json();
  if (!cardId || typeof accepted !== "boolean") {
    return NextResponse.json({ error: "cardId and accepted (boolean) required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("agent_deck_cards")
    .update({ accepted, decided_at: new Date().toISOString() })
    .eq("id", cardId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
