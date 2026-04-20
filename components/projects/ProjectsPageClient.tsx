"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  X,
  Loader2,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Gamepad2,
  BookOpen,
  Wand2,
  Trash2,
} from "lucide-react";
import { Project, ProjectStatus } from "@/lib/types/project";
import type { Agent } from "@/lib/services/agentService";
import type { GameGenre, SessionDuration } from "@/lib/types/brainstorming";

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

const GENRES: { id: GameGenre; label: string; desc: string }[] = [
  { id: "action", label: "Action", desc: "Réflexes, timing, pression" },
  { id: "puzzle", label: "Puzzle", desc: "Réflexion, logique, déduction" },
  { id: "stealth", label: "Stealth", desc: "Infiltration, patience, observation" },
  { id: "arcade", label: "Arcade", desc: "Score, rapidité, répétition" },
  { id: "rpg", label: "RPG", desc: "Choix, progression, narration" },
  { id: "autre", label: "Autre", desc: "Hors catégorie" },
];

const DURATIONS: { id: SessionDuration; label: string; desc: string }[] = [
  { id: "2min", label: "< 2 min", desc: "Micro-session, one shot" },
  { id: "5min", label: "5 min", desc: "Session courte, rejouable" },
  { id: "15min", label: "10–15 min", desc: "Session longue, progression" },
];

function statusBadgeClass(status: ProjectStatus) {
  switch (status) {
    case "concept":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    case "in-dev":
      return "bg-primary/15 text-primary border-primary/30";
    case "released":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }
}

function CourseCard({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  const { courseInfo } = project;
  const mechanics = courseInfo?.mechanics ?? [];

  return (
    <div className="group relative rounded-2xl bg-card border border-white/8 overflow-hidden hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
      <button
        onClick={(e) => { e.preventDefault(); onDelete(project.id); }}
        className="absolute top-3 left-3 z-20 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
        title="Supprimer le projet"
      >
        <Trash2 className="w-3.5 h-3.5 text-white" />
      </button>
    <Link
      href={`/projects/${project.id}`}
      className="block"
    >
      <div className={`h-32 bg-linear-to-br ${project.coverGradient} relative flex items-end p-3`}>
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        {courseInfo && (
          <span className="relative z-10 text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md backdrop-blur-sm">
            {courseInfo.vnModule}
          </span>
        )}
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Gamepad2 className="w-4 h-4 text-white/60" />
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-base text-foreground group-hover:text-emerald-300 transition-colors leading-tight">
            {project.title}
          </h3>
          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass(project.status)}`}>
            {statusLabels[project.status]}
          </span>
        </div>

        {courseInfo ? (
          <div className="flex items-center gap-1.5 mb-3">
            <GraduationCap className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-400 font-medium">{courseInfo.courseName}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {project.description}
          </p>
        )}

        {mechanics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {mechanics.map((mechanic) => (
              <span key={mechanic} className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-muted-foreground">
                {mechanic}
              </span>
            ))}
          </div>
        )}

        <div className="border-t border-white/8 pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />
            {project.genre}
          </div>
          <span className="font-medium text-white/40">
            {courseInfo?.webEngine ? courseInfo.webEngine.toUpperCase() : project.engine}
          </span>
        </div>
      </div>
    </Link>
    </div>
  );
}

// ============================================================
// Nouvelle modale de création — 2 étapes
// ============================================================

interface Step1Form {
  title: string;
  description: string;
  coverGradient: string;
}

interface Step2Form {
  genre: GameGenre | null;
  sessionDuration: SessionDuration | null;
  referenceGame: string;
  theme: string;
}

function NewProjectModal({
  agents,
  onClose,
  onCreated,
}: {
  agents: Agent[];
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1, setStep1] = useState<Step1Form>({
    title: "",
    description: "",
    coverGradient: "from-slate-900 via-gray-800 to-zinc-900",
  });
  const [step2, setStep2] = useState<Step2Form>({
    genre: null,
    sessionDuration: null,
    referenceGame: "",
    theme: "",
  });
  const [themeSuggestions, setThemeSuggestions] = useState<string[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [refSuggestions, setRefSuggestions] = useState<{ title: string; why: string }[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set1(field: keyof Step1Form, value: string) {
    setStep1((prev) => ({ ...prev, [field]: value }));
  }

  function set2<K extends keyof Step2Form>(field: K, value: Step2Form[K]) {
    setStep2((prev) => ({ ...prev, [field]: value }));
  }

  async function fetchThemeSuggestions(genre: GameGenre, duration: SessionDuration) {
    setLoadingThemes(true);
    try {
      const res = await fetch("/api/brief/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "theme", genre, sessionDuration: duration }),
      });
      if (res.ok) {
        const data = await res.json();
        setThemeSuggestions(data.suggestions ?? []);
      }
    } finally {
      setLoadingThemes(false);
    }
  }

  async function fetchRefSuggestions() {
    if (!step2.genre || !step2.sessionDuration) return;
    setLoadingRefs(true);
    try {
      const res = await fetch("/api/brief/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reference",
          genre: step2.genre,
          sessionDuration: step2.sessionDuration,
          theme: step2.theme,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRefSuggestions(data.suggestions ?? []);
      }
    } finally {
      setLoadingRefs(false);
    }
  }

  function handleGenreSelect(genre: GameGenre) {
    set2("genre", genre);
    if (step2.sessionDuration) fetchThemeSuggestions(genre, step2.sessionDuration);
  }

  function handleDurationSelect(duration: SessionDuration) {
    set2("sessionDuration", duration);
    if (step2.genre) fetchThemeSuggestions(step2.genre, duration);
  }

  async function handleSubmit() {
    if (!step2.genre || !step2.sessionDuration || !step2.theme) {
      setError("Complète le genre, la durée et le thème");
      return;
    }

    const gameDesignAgents = agents.filter((a) => a.department === "game-design");
    if (gameDesignAgents.length === 0) {
      setError("Aucun agent Game Design disponible. Recrute d'abord un game designer.");
      return;
    }
    const agentSlug = gameDesignAgents[0].slug;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: step1.title,
          description: step1.description,
          status: "concept",
          genre: "À définir",
          engine: "À définir",
          coverGradient: step1.coverGradient,
          platforms: [],
          tags: [],
          team: [],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la création");
      }
      const project: Project = await res.json();

      // Créer la session avec le brief et l'agent GD sélectionné
      const sessionRes = await fetch(`/api/brainstorming/${project.id}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentSlugs: [agentSlug],
          gameBrief: {
            genre: step2.genre,
            sessionDuration: step2.sessionDuration,
            referenceGame: step2.referenceGame,
            theme: step2.theme,
          },
        }),
      });
      if (!sessionRes.ok) {
        const data = await sessionRes.json();
        throw new Error(data.error ?? "Erreur lors de la création de la session");
      }

      onCreated(project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-card border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div>
            <h2 className="font-bold text-lg">Nouveau cours</h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2].map((n) => (
                <div key={n} className={`h-1 rounded-full transition-all ${n === step ? "w-8 bg-primary" : n < step ? "w-4 bg-primary/40" : "w-4 bg-white/10"}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{step === 1 ? "Identité" : "Brief design"}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Titre du mini-jeu *</label>
                <input
                  required
                  value={step1.title}
                  onChange={(e) => set1("title", e.target.value)}
                  placeholder="Ex : L&apos;Art de la Séduction"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description courte</label>
                <textarea
                  value={step1.description}
                  onChange={(e) => set1("description", e.target.value)}
                  rows={2}
                  placeholder="Une ligne sur l'idée — le reste se précisera dans le brief"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Couleur de couverture</label>
                <div className="grid grid-cols-3 gap-2">
                  {coverGradients.map((gradient) => (
                    <button
                      key={gradient.value}
                      type="button"
                      onClick={() => set1("coverGradient", gradient.value)}
                      className={`h-12 rounded-lg bg-linear-to-br ${gradient.value} border-2 transition-all ${
                        step1.coverGradient === gradient.value ? "border-primary scale-105" : "border-transparent"
                      }`}
                      title={gradient.label}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Genre */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Genre mécanique *</label>
                <div className="grid grid-cols-2 gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleGenreSelect(g.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        step2.genre === g.id
                          ? "border-primary/60 bg-primary/10"
                          : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="text-sm font-semibold">{g.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Durée d&apos;une session *</label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleDurationSelect(d.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        step2.sessionDuration === d.id
                          ? "border-primary/60 bg-primary/10"
                          : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="text-sm font-semibold">{d.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Thème */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Univers / Thème *</label>
                  {loadingThemes && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
                {themeSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {themeSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set2("theme", s)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          step2.theme === s
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-white/15 bg-white/5 text-muted-foreground hover:border-white/30"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {(!step2.genre || !step2.sessionDuration) && themeSuggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 mb-2">Sélectionne le genre et la durée pour voir des suggestions</p>
                )}
                <input
                  value={step2.theme}
                  onChange={(e) => set2("theme", e.target.value)}
                  placeholder="Ex : Espion médiéval — séduction et assassinat"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Jeu de référence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Jeu de référence</label>
                  <button
                    type="button"
                    onClick={fetchRefSuggestions}
                    disabled={!step2.genre || !step2.sessionDuration || loadingRefs}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingRefs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Suggère-moi
                  </button>
                </div>
                {refSuggestions.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {refSuggestions.map((r) => (
                      <button
                        key={r.title}
                        type="button"
                        onClick={() => set2("referenceGame", r.title)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                          step2.referenceGame === r.title
                            ? "border-primary/60 bg-primary/10"
                            : "border-white/10 bg-white/3 hover:border-white/20"
                        }`}
                      >
                        <span className="font-semibold text-foreground">{r.title}</span>
                        <span className="text-muted-foreground ml-2">{r.why}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={step2.referenceGame}
                  onChange={(e) => set2("referenceGame", e.target.value)}
                  placeholder="Ex : Hitman GO, Papers Please…"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-white/8 shrink-0">
          {step === 1 ? (
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium transition-colors">
              Annuler
            </button>
          ) : (
            <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium transition-colors">
              Retour
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              disabled={!step1.title.trim()}
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              Brief design
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !step2.genre || !step2.sessionDuration || !step2.theme}
              onClick={handleSubmit}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Lancer le One Page
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page principale
// ============================================================

export function ProjectsPageClient({
  initialProjects,
  initialAgents,
}: {
  initialProjects: Project[];
  initialAgents: Agent[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleProjectCreated(project: Project) {
    setProjects((prev) => [...prev, project]);
    router.push(`/brainstorming/${project.id}`);
  }

  function handleDeleteRequest(id: string) {
    const project = projects.find((p) => p.id === id) ?? null;
    setDeleteTarget(project);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la suppression");
      }
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 sm:mb-10 flex items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Catalogue des Cours</h1>
            </div>
            <p className="text-muted-foreground">
              {projects.length} cours — mini-jeux web de l&apos;Université d&apos;Espions
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau cours
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map(({ status, color, dot }) => {
            const col = projects.filter((project) => project.status === status);
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
                    col.map((project) => (
                      <CourseCard key={project.id} project={project} onDelete={handleDeleteRequest} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <NewProjectModal
          agents={initialAgents}
          onClose={() => setShowModal(false)}
          onCreated={handleProjectCreated}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Supprimer le projet</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Cette action est irréversible</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-1">
              Tu vas supprimer <span className="font-semibold text-foreground">{deleteTarget.title}</span>.
            </p>
            {deleteTarget.githubRepoName && (
              <p className="text-xs text-red-400/80 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2 mb-4">
                Le repo GitHub <span className="font-mono">{deleteTarget.githubRepoName}</span> sera également supprimé.
              </p>
            )}

            {deleteError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{deleteError}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-sm font-medium transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
