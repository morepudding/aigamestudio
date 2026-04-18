import { getProjectById } from "@/lib/services/projectService";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Users,
  Code,
  PenTool,
  Wand2,
  MessageCircle,
  Settings,
  GraduationCap,
  BookOpen,
  Puzzle,
  ExternalLink,
} from "lucide-react";
import PipelineView from "@/components/pipeline/PipelineView";

const statusLabels: Record<string, string> = {
  concept: "Concept",
  "in-dev": "En développement",
  released: "Sorti",
};

const statusDot: Record<string, string> = {
  concept: "bg-blue-400",
  "in-dev": "bg-violet-400 animate-pulse",
  released: "bg-emerald-400",
};

const getRoleIcon = (name: string) => {
  if (name.toLowerCase() === "romain") return <PenTool className="w-4 h-4" />;
  if (name.toLowerCase() === "léa" || name.toLowerCase() === "sofia")
    return <Wand2 className="w-4 h-4" />;
  if (name.toLowerCase() === "karim") return <Code className="w-4 h-4" />;
  return <Users className="w-4 h-4" />;
};

const getRoleName = (name: string) => {
  if (name.toLowerCase() === "romain") return "Game Designer / Writer";
  if (name.toLowerCase() === "léa" || name.toLowerCase() === "sofia")
    return "Lead Artist";
  if (name.toLowerCase() === "karim") return "Lead Dev";
  return "Collaborateur";
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) return notFound();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-24">
      {/* ── Header / Hero ── */}
      <section className="relative">
        <div
          className={`absolute inset-0 h-80 bg-linear-to-b ${project.coverGradient} opacity-20 -z-10`}
        />
        <div className="absolute inset-0 h-80 bg-linear-to-b from-transparent to-background -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12">
          {/* Nav */}
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux projets
          </Link>

          {/* Project Title & Status */}
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                {project.courseInfo ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <GraduationCap className="w-3 h-3" />
                    {project.courseInfo.vnModule}
                  </span>
                ) : (
                  <span className="px-3 py-1 text-xs font-semibold rounded-md bg-white/10 text-white backdrop-blur-md">
                    {project.genre}
                  </span>
                )}
                <span className="px-3 py-1 text-xs font-semibold rounded-md border border-white/10 text-muted-foreground">
                  {project.courseInfo?.webEngine?.toUpperCase() ?? project.engine}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border border-white/10 text-white/70">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot[project.status]}`} />
                  {statusLabels[project.status]}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight mb-2">
                {project.title}
              </h1>
              {project.courseInfo && (
                <p className="text-base text-emerald-400 font-medium mb-2">
                  {project.courseInfo.courseName}
                </p>
              )}
              <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
                {project.description}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Link
                href={`/projects/${project.id}/decisions`}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-sm font-medium text-indigo-300 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Décisions
              </Link>
              {project.githubRepoUrl && (
                <a
                  href={project.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
                >
                  <Code className="w-4 h-4" />
                  <span className="hidden sm:inline">GitHub</span>
                  <span className="sm:hidden">Repo</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 w-full">
        {/* Left column (Pipeline) */}
        <div className="lg:col-span-2 space-y-8">
          {project.status === "concept" && !project.decisionsReady && (
            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-200">Cadrage requis avant la rédaction</p>
                  <p className="mt-1 text-amber-100/80">
                    Les 5 documents de conception dépendent du cadrage avec Eve. Tant qu&apos;il n&apos;est pas validé,
                    la génération du pipeline documentaire reste bloquée.
                  </p>
                </div>
              </div>
            </section>
          )}

          <PipelineView projectId={project.id} phase={project.status} decisionsReady={project.decisionsReady} />

          <section className="bg-white/2 border border-white/8 backdrop-blur-md rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white/60 mb-4">Informations Techniques</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Plateformes</span>
                <span className="text-sm font-medium">{project.platforms.join(", ")}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Moteur</span>
                <span className="text-sm font-medium">{project.engine}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Statut</span>
                <span className="text-sm font-medium text-primary">{statusLabels[project.status]}</span>
              </div>
              {project.githubRepoUrl && (
                <div>
                  <span className="block text-xs text-muted-foreground mb-1">GitHub</span>
                  <a
                    href={project.githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-400 hover:underline truncate block"
                  >
                    {project.githubRepoName ?? "Repo"}
                  </a>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column (Course info + Team) */}
        <div className="space-y-6">
          {/* Course info */}
          {project.courseInfo && (
            <div className="bg-emerald-950/30 border border-emerald-500/20 backdrop-blur-md rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Université d&apos;Espions
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="block text-xs text-muted-foreground mb-0.5">Cours</span>
                  <span className="text-sm font-semibold text-foreground">{project.courseInfo.courseName}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground mb-0.5">Module VN</span>
                  <span className="text-sm font-medium text-emerald-300">{project.courseInfo.vnModule}</span>
                </div>
                {project.courseInfo.mechanics.length > 0 && (
                  <div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                      <Puzzle className="w-3 h-3" /> Mécaniques
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {project.courseInfo.mechanics.map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {project.courseInfo.webEngine && (
                  <div>
                    <span className="block text-xs text-muted-foreground mb-0.5">Engine web</span>
                    <span className="text-sm font-mono text-foreground">{project.courseInfo.webEngine}</span>
                  </div>
                )}
                {project.courseInfo.targetIntegrationUrl && (
                  <div>
                    <span className="block text-xs text-muted-foreground mb-0.5">Intégration VN</span>
                    <a
                      href={project.courseInfo.targetIntegrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {project.courseInfo.targetIntegrationUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white/2 border border-white/8 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Équipe ({project.team.length})</h3>
              <button className="text-xs font-medium text-primary hover:underline">
                Gérer
              </button>
            </div>

            <div className="space-y-4">
              {project.team.map((member) => (
                <div
                  key={member}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                    {member.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {member}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getRoleName(member)}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground shrink-0">
                    {getRoleIcon(member)}
                  </div>
                </div>
              ))}

              {/* Dev Agent placeholder if small team */}
              {project.team.length < 3 && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/20 opacity-70 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer group">
                   <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                     <Settings className="w-4 h-4" />
                   </div>
                   <div className="flex-1">
                     <p className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        Agent Développeur
                     </p>
                     <p className="text-xs text-muted-foreground/50">
                        IA Autonome
                     </p>
                   </div>
                   <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">
                     +
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
