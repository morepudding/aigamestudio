import { NextRequest, NextResponse } from "next/server";
import { upsertTaskReview, getReviewsByProject } from "@/lib/services/taskReviewService";

// GET /api/post-mortem/[projectId]/reviews
// Retourne toutes les reviews d'un projet
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const reviews = await getReviewsByProject(projectId);
  return NextResponse.json(reviews);
}

// POST /api/post-mortem/[projectId]/reviews
// Crée ou met à jour la review d'une tâche
// Body: { task_id, agent_slug, rating, comment? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();

  const { task_id, agent_slug, rating, comment } = body;

  if (!task_id || !agent_slug || rating == null) {
    return NextResponse.json({ error: "task_id, agent_slug and rating are required" }, { status: 400 });
  }

  const ratingNum = Number(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "rating must be between 1 and 5" }, { status: 400 });
  }

  try {
    const review = await upsertTaskReview({
      task_id,
      project_id: projectId,
      agent_slug,
      rating: ratingNum,
      comment: comment ?? null,
    });
    return NextResponse.json(review);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save review" },
      { status: 500 }
    );
  }
}
