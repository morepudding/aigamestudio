import { supabase } from "@/lib/supabase/client";
import { Project, ProjectStatus } from "@/lib/types/project";
import { projects as staticProjects, getProjectStatus } from "@/lib/data/projects";

type DbProject = {
  id: string;
  title: string;
  description: string;
  cover_gradient: string;
  status: ProjectStatus;
  genre: string;
  platforms: string[];
  tags: string[];
  team: string[];
  engine: string;
  github_repo_url: string | null;
  github_repo_name: string | null;
  active: boolean;
  decisions_ready: boolean;
  course_info: import("@/lib/types/project").CourseInfo | null;
  gdd_original: import("@/lib/types/contracts").GDDOriginal | null;
  gdd_vivant: import("@/lib/types/contracts").GDDVivant | null;
  deployment_url: string | null;
};

function toProject(row: DbProject): Project {
  const staticProject = staticProjects.find((p) => p.id === row.id);
  const project: Project = {
    id: row.id,
    title: row.title,
    description: row.description,
    coverGradient: row.cover_gradient,
    status: row.status,
    genre: row.genre,
    platforms: row.platforms,
    tags: row.tags,
    team: row.team,
    engine: row.engine,
    githubRepoUrl: row.github_repo_url,
    githubRepoName: row.github_repo_name,
    active: row.active,
    decisionsReady: row.decisions_ready,
    conceptDeliverables: staticProject?.conceptDeliverables,
    courseInfo: row.course_info ?? staticProject?.courseInfo ?? null,
    gddOriginal: row.gdd_original ?? null,
    gddVivant: row.gdd_vivant ?? null,
    deploymentUrl: row.deployment_url ?? null,
  };
  // Only recompute status when the DB says "concept" — let "in-dev" and "released"
  // pass through so manual/automated transitions are not overridden.
  if (row.status === "concept") {
    project.status = getProjectStatus(project);
  }
  return project;
}

export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as DbProject[]).map(toProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toProject(data as DbProject);
}

export async function createProject(
  project: Omit<Project, "id"> & { id?: string }
): Promise<Project | null> {
  const id =
    project.id ??
    project.title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      id,
      title: project.title,
      description: project.description,
      cover_gradient: project.coverGradient,
      status: project.status,
      genre: project.genre,
      platforms: project.platforms,
      tags: project.tags,
      team: project.team,
      engine: project.engine,
      decisions_ready: project.decisionsReady,
    })
    .select()
    .single();

  if (error || !data) return null;
  return toProject(data as DbProject);
}

export async function deleteProject(id: string): Promise<{ githubRepoName: string | null } | null> {
  const project = await getProjectById(id);
  if (!project) return null;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return null;
  return { githubRepoName: project.githubRepoName };
}

export async function transitionToInDev(id: string): Promise<Project | null> {
  return updateProject(id, { status: "in-dev" });
}

export async function updateProject(
  id: string,
  fields: Partial<Omit<Project, "id">>
): Promise<Project | null> {
  const dbFields: Record<string, unknown> = {};
  if (fields.title !== undefined) dbFields.title = fields.title;
  if (fields.description !== undefined) dbFields.description = fields.description;
  if (fields.coverGradient !== undefined) dbFields.cover_gradient = fields.coverGradient;
  if (fields.status !== undefined) dbFields.status = fields.status;
  if (fields.genre !== undefined) dbFields.genre = fields.genre;
  if (fields.platforms !== undefined) dbFields.platforms = fields.platforms;
  if (fields.tags !== undefined) dbFields.tags = fields.tags;
  if (fields.team !== undefined) dbFields.team = fields.team;
  if (fields.engine !== undefined) dbFields.engine = fields.engine;
  if (fields.githubRepoUrl !== undefined) dbFields.github_repo_url = fields.githubRepoUrl;
  if (fields.githubRepoName !== undefined) dbFields.github_repo_name = fields.githubRepoName;
  if (fields.active !== undefined) dbFields.active = fields.active;
  if (fields.decisionsReady !== undefined) dbFields.decisions_ready = fields.decisionsReady;
  if (fields.deploymentUrl !== undefined) dbFields.deployment_url = fields.deploymentUrl;

  const { data, error } = await supabase
    .from("projects")
    .update(dbFields)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return toProject(data as DbProject);
}
