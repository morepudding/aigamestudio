import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

// GET /api/pipeline/[projectId]/tasks-summary
// Retourne les tâches complètes d'un projet avec le nom et département de l'agent assigné.
// Utilisé par le post-mortem pour afficher les tâches par agent.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Récupérer les tâches complétées et assignées
  const { data: tasks, error } = await supabase
    .from("pipeline_tasks")
    .select("id, title, description, assigned_agent_slug, status")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .not("assigned_agent_slug", "is", null)
    .order("sort_order", { ascending: true });

  if (error || !tasks) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  if (tasks.length === 0) {
    return NextResponse.json([]);
  }

  // Récupérer les infos des agents assignés
  const agentSlugs = [...new Set(tasks.map((t) => t.assigned_agent_slug as string))];
  const { data: agents } = await supabase
    .from("agents")
    .select("slug, name, department")
    .in("slug", agentSlugs);

  const agentMap = new Map(
    (agents ?? []).map((a) => [a.slug, { name: a.name, department: a.department }])
  );

  const result = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    assigned_agent_slug: t.assigned_agent_slug,
    agent_name: agentMap.get(t.assigned_agent_slug!)?.name ?? t.assigned_agent_slug,
    agent_department: agentMap.get(t.assigned_agent_slug!)?.department ?? "",
  }));

  return NextResponse.json(result);
}
