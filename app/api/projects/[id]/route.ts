import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProject, deleteProject } from "@/lib/services/projectService";
import { deleteRepo } from "@/lib/services/githubService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await deleteProject(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.githubRepoName) {
    try {
      await deleteRepo(result.githubRepoName);
    } catch {
      // Repo deletion failed but project is already deleted — log and continue
    }
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const project = await updateProject(id, body);
  if (!project) return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });
  return NextResponse.json(project);
}
