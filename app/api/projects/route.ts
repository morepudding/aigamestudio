import { NextRequest, NextResponse } from "next/server";
import { getAllProjects, createProject } from "@/lib/services/projectService";

export async function GET() {
  const projects = await getAllProjects();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { title, description, status, genre, engine, coverGradient, platforms, tags, team } = body;

  if (!title || !status || !genre || !engine) {
    return NextResponse.json(
      { error: "Missing required fields: title, status, genre, engine" },
      { status: 400 }
    );
  }

  const project = await createProject({
    title,
    description: description ?? "",
    status,
    genre,
    engine,
    coverGradient: coverGradient ?? "from-slate-900 via-gray-800 to-zinc-900",
    platforms: Array.isArray(platforms) ? platforms : (platforms ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    tags: Array.isArray(tags) ? tags : (tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    team: Array.isArray(team) ? team : (team ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    githubRepoUrl: null,
    githubRepoName: null,
    active: true,
    decisionsReady: false,
    courseInfo: null,
    gddOriginal: null,
    gddVivant: null,
  });

  if (!project) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  return NextResponse.json(project, { status: 201 });
}
