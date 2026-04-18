import { NextRequest, NextResponse } from "next/server";
import { getAgentBySlug, updateAgentFields, AgentMood } from "@/lib/services/agentService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  if (!safeSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const body = await req.json();
  const allowedFields = ["status", "assigned_project", "portrait_url", "icon_url", "mood", "mood_cause", "mood_updated_at", "confidence_level", "appearance_prompt", "personality_bio", "gender"] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  // Validate mood if provided
  if (updates.mood) {
    const validMoods: AgentMood[] = [
      "neutre", "enthousiaste", "frustré", "curieux", "fier",
      "inquiet", "joueur", "nostalgique", "inspiré", "agacé",
    ];
    if (!validMoods.includes(updates.mood as AgentMood)) {
      return NextResponse.json({ error: "Invalid mood" }, { status: 400 });
    }
  }

  // Validate confidence_level if provided
  if (updates.confidence_level !== undefined) {
    const cl = Number(updates.confidence_level);
    if (isNaN(cl) || cl < 0 || cl > 300) {
      return NextResponse.json({ error: "Invalid confidence_level" }, { status: 400 });
    }
    updates.confidence_level = cl;
  }

  // Validate gender if provided
  if (updates.gender !== undefined) {
    const validGenders = ["femme", "homme"];
    if (!validGenders.includes(String(updates.gender))) {
      return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateAgentFields(safeSlug, updates as any);
    return NextResponse.json({ success: true, ...updates });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
