import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // Delete all memories
  const { error: memoryError } = await supabase
    .from("agent_memory")
    .delete()
    .eq("agent_slug", safeSlug);

  if (memoryError) {
    return NextResponse.json({ error: "Failed to delete memories" }, { status: 500 });
  }

  // Reset agent state (full reset including personality_nuance)
  const { error: agentError } = await supabase
    .from("agents")
    .update({
      status: "recruté",
      confidence_level: 0,
      mood: "neutre",
      mood_cause: null,
      personality_nuance: null,
    })
    .eq("slug", safeSlug);

  if (agentError) {
    return NextResponse.json({ error: "Failed to reset agent" }, { status: 500 });
  }

  return NextResponse.json({ success: true, slug: safeSlug });
}
