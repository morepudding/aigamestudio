import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProject } from "@/lib/services/projectService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
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
