import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentSlug, step, theme, playerChoice, agentReaction } = body as {
    agentSlug: string;
    step: number;
    theme: string;
    playerChoice: string;
    agentReaction: string;
  };

  if (!agentSlug || !step || !theme || !playerChoice || !agentReaction) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const safeSlug = agentSlug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug || step < 1 || step > 5) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("onboarding_choices")
    .upsert(
      {
        agent_slug: safeSlug,
        step,
        theme,
        player_choice: playerChoice,
        agent_reaction: agentReaction,
      },
      { onConflict: "agent_slug,step" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
