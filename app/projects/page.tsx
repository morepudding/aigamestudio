"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Loader2, Users, ChevronRight, Sparkles } from "lucide-react";
import { Project, ProjectStatus } from "@/lib/types/project";
import type { Agent } from "@/lib/services/agentService";

const statusLabels: Record<string, string> = {
  concept: "Concept",
  "in-dev": "En développement",
  released: "Sorti",
};

const columns: { status: ProjectStatus; color: string; dot: string }[] = [
  { status: "concept", color: "border-yellow-500/30 bg-yellow-500/5", dot: "bg-yellow-400" },
  { status: "in-dev", color: "border-primary/30 bg-primary/5", dot: "bg-primary" },
  { status: "released", color: "border-emerald-500/30 bg-emerald-500/5", dot: "bg-emerald-400" },
];

const coverGradients = [
  { label: "Ardoise", value: "from-slate-900 via-gray-800 to-zinc-900" },
  { label: "Violet", value: "from-violet-900 via-purple-800 to-fuchsia-900" },
  { label: "Bleu nuit", value: "from-blue-900 via-indigo-800 to-slate-900" },
  { label: "Emeraude", value: "from-emerald-900 via-teal-800 to-cyan-900" },
  { label: "Feu", value: "from-red-900 via-orange-800 to-amber-900" },
  { label: "Rose", value: "from-pink-900 via-rose-800 to-red-900" },
];

function statusBadgeClass(status: ProjectStatus) {
  switch (status) {
    case "concept": return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    case "in-dev": return "bg-primary/15 text-primary border-primary/30";
    case "released": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group rounded-2xl bg-card border border-white/8 overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 block"
    >
      <div className={`h-36 bg-linear-to-br ${project.coverGradient} relative`}>
        <div className="absolute inset-0 bg-linear-to-t from-card/70 to-transparent" />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors leading-tight">
            {project.title}
          </h3>
          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass(project.status)}`}>
            {statusLabels[project.status]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {project.description}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
        <div className="border-t border-white/8 pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
            {project.genre}
          </div>
          <span>{project.platforms.join(", ")}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{project.engine}</span>
          <span>{project.team.length === 1 ? `Solo — ${project.team[0]}` : `${project.team.length} pers.`}</span>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// Step 1: New Project Modal (simplified)
// ============================================================

interface NewProjectForm {
  title: string;
  description: string;
  coverGradient: string;
}

const emptyForm: NewProjectForm = {
  title: "",
  description: "",
  coverGradient: "from-slate-900 via-gray-800 to-zinc-900",
};

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof NewProjectForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          status: "concept",
          genre: "À définir",
          engine: "À définir",
          coverGradient: form.coverGradient,
          platforms: [],
          tags: [],
          team: [],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la création");
      }
      const created: Project = await res.json();
      onCreated(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="font-bold text-lg">Nouveau projet</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Tu pourras affiner le scope avec ton équipe ensuite</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Titre du jeu *</label>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex : First Light"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description courte</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Une idée en quelques mots… le reste se définira pendant le brainstorming"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Couleur de couverture</label>
            <div className="grid grid-cols-3 gap-2">
              {coverGradients.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => set("coverGradient", g.value)}
                  className={`h-12 rounded-lg bg-linear-to-br ${g.value} border-2 transition-all ${
                    form.coverGradient === g.value ? "border-primary scale-105" : "border-transparent"
                  }`}
                  title={g.label}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Suivant
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Collaborator Picker Modal
// ============================================================

function CollaboratorPickerModal({
  project,
  agents,
  onClose,
  onStart,
}: {
  project: Project;
  agents: Agent[];
  onClose: () => void;
  onStart: (agentSlugs: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DEPT_LABELS: Record<string, string> = {
    "game-design": "Game Design",
    "programming": "Programmation",
    "art": "Art & DA",
    "audio": "Audio",
    "narrative": "Narration",
    "qa": "QA",
    "marketing": "Marketing",
    "production": "Production",
  };

  function toggleAgent(slug: string) {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < 3
        ? [...prev, slug]
        : prev
    );
  }

  async function handleStart() {
    if (selected.length < 1) {
      setError("Sélectionne au moins 1 collaborateur");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      // Create brainstorming session
      const res = await fetch(`/api/brainstorming/${project.id}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSlugs: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors du démarrage");
      }
      onStart(selected);
    } catch (err) {
      setError((err as Error).message);
      setStarting(false);
    }
  }

  // Group agents by department
  const byDept: Record<string, Agent[]> = {};
  for (const agent of agents) {
    if (!byDept[agent.department]) byDept[agent.department] = [];
    byDept[agent.department].push(agent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="font-bold text-lg">Équipe de brainstorming</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sélectionne 1 à 3 collaborateurs pour cadrer <span className="text-foreground font-medium">{project.title}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Selected count indicator */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < selected.length ? "bg-primary" : "bg-white/15"}`} />
              ))}
            </div>
            <span className="text-muted-foreground">{selected.length}/3 sélectionné{selected.length > 1 ? "s" : ""}</span>
            {selected.length === 3 && <span className="text-amber-400">Maximum atteint</span>}
          </div>

          {/* Agent list by department */}
          {Object.entries(byDept).map(([dept, deptAgents]) => (
            <div key={dept}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {DEPT_LABELS[dept] ?? dept}
              </p>
              <div className="space-y-2">
                {deptAgents.map((agent) => {
                  const isSelected = selected.includes(agent.slug);
                  const isDisabled = !isSelected && selected.length >= 3;
                  return (
                    <button
                      key={agent.slug}
                      onClick={() => toggleAgent(agent.slug)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? "border-primary/50 bg-primary/10"
                          : isDisabled
                          ? "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
                          : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-white/10 text-foreground"}`}>
                        {agent.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{agent.name}</span>
                          {isSelected && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">Sélectionné</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                      </div>
                      <div className={`w-4 h-4 rounded border-2 shrink-0 transition-colors ${isSelected ? "border-primary bg-primary" : "border-white/20"}`}>
                        {isSelected && (
                          <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-0.5">
                            <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Aucun collaborateur disponible.<br />
              Recrute d&apos;abord des agents dans l&apos;onglet Collaborateurs.
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        <div className="flex justify-between items-center px-6 py-4 border-t border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium transition-colors">
            Retour
          </button>
          <button
            onClick={handleStart}
            disabled={selected.length === 0 || starting}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {starting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Démarrage…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Lancer le brainstorming</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"idle" | "new-project" | "pick-agents">("idle");
  const [pendingProject, setPendingProject] = useState<Project | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()).catch(() => []),
    ]).then(([projs, agts]: [Project[], Agent[]]) => {
      setProjects(projs);
      setAgents(agts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function handleProjectCreated(project: Project) {
    setProjects((prev) => [...prev, project]);
    setPendingProject(project);
    setStep("pick-agents");
  }

  function handleBrainstormingStarted(agentSlugs: string[]) {
    if (!pendingProject) return;
    router.push(`/brainstorming/${pendingProject.id}`);
  }

  return (
    <div className="px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Nos projets</h1>
            <p className="text-muted-foreground">
              {projects.length} jeu{projects.length > 1 ? "x" : ""} en cours ou planifié{projects.length > 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setStep("new-project")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau projet
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground animate-pulse">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {columns.map(({ status, color, dot }) => {
              const col = projects.filter((p) => p.status === status);
              return (
                <div key={status} className="flex flex-col gap-4">
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${color}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dot}`} />
                      <span className="text-sm font-semibold text-foreground">{statusLabels[status]}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/8 text-muted-foreground">
                      {col.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {col.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                        <p className="text-xs text-muted-foreground/50">Aucun projet ici</p>
                      </div>
                    ) : (
                      col.map((project) => <ProjectCard key={project.id} project={project} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {step === "new-project" && (
        <NewProjectModal
          onClose={() => setStep("idle")}
          onCreated={handleProjectCreated}
        />
      )}

      {step === "pick-agents" && pendingProject && (
        <CollaboratorPickerModal
          project={pendingProject}
          agents={agents}
          onClose={() => { setStep("idle"); setPendingProject(null); }}
          onStart={handleBrainstormingStarted}
        />
      )}
    </div>
  );
}
