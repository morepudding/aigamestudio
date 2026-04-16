import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { personality_nuance } = body;

  if (!personality_nuance || typeof personality_nuance !== "string") {
    return NextResponse.json({ error: "Invalid personality_nuance" }, { status: 400 });
  }

  // Validate length constraint (50 chars max per schema)
  if (personality_nuance.length > 50) {
    return NextResponse.json({ error: "personality_nuance too long (max 50 chars)" }, { status: 400 });
  }

  const { error } = await supabase
    .from("agents")
    .update({ personality_nuance })
    .eq("slug", "eve");

  if (error) {
    return NextResponse.json({ error: "Failed to update personality" }, { status: 500 });
  }

  return NextResponse.json({ success: true, personality_nuance });
}
