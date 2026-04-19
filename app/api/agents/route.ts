import { NextRequest, NextResponse } from "next/server";
import { getAllAgents, deleteAgent } from "@/lib/services/agentService";

export async function GET() {
  const agents = await getAllAgents();
  return NextResponse.json(agents, {
    headers: {
      // Agents changent rarement — 60s de cache, 5min stale-while-revalidate
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function DELETE(req: NextRequest) {
  const { slug } = await req.json();

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    await deleteAgent(slug);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}

