import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import type { MomentVivantScenario } from "@/lib/types/momentVivant";

type DbMoment = {
  id: string;
  agent_slug: string;
  moment_type: string;
  message_ouverture: string;
  scene: unknown;
  status: string;
  chat_message_id: string | null;
  scheduled_at: string;
  opened_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function toScenario(row: DbMoment): MomentVivantScenario {
  return {
    id: row.id,
    agentSlug: row.agent_slug,
    momentType: row.moment_type as MomentVivantScenario["momentType"],
    messageOuverture: row.message_ouverture,
    scene: row.scene as MomentVivantScenario["scene"],
    status: row.status as MomentVivantScenario["status"],
    chatMessageId: row.chat_message_id,
    scheduledAt: row.scheduled_at,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/** GET — récupère le moment actif (opened) pour cet agent */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;

  const { data, error } = await supabase
    .from("pending_moments")
    .select("*")
    .eq("agent_slug", agentSlug)
    .eq("status", "opened")
    .single();

  if (error || !data) {
    return NextResponse.json({ moment: null });
  }

  return NextResponse.json({ moment: toScenario(data as DbMoment) });
}

/** PATCH — met à jour le statut (opened, completed) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;
  const body = await req.json() as { momentId: string; status: "opened" | "completed" };
  const { momentId, status } = body;

  if (!momentId || !status) {
    return NextResponse.json({ error: "Missing momentId or status" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "opened") updates.opened_at = new Date().toISOString();
  if (status === "completed") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("pending_moments")
    .update(updates)
    .eq("id", momentId)
    .eq("agent_slug", agentSlug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
