import { DeckCard } from "@/lib/types/deck";

/**
 * Deck global du studio — partagé par tous les agents.
 * Anecdotes, souvenirs et événements de la vie du studio.
 *
 * Pour ajouter une carte :
 * 1. Copier un objet existant
 * 2. Changer l'id (format: "studio-XXX")
 * 3. Remplir content, themes, type
 * 4. Optionnel: minConfidence (carte dispo seulement si confiance >= X)
 */
export const STUDIO_DECK: DeckCard[] = [
  // ─── ANECDOTES ───────────────────────────────────────
  {
    id: "studio-001",
    type: "anecdote",
    scope: "studio",
    agentSlug: null,
    content: "La première semaine du studio, il n'y avait qu'un bureau, une chaise et un écran branché sur rien. Le boss a quand même fait une 'réunion d'équipe' tout seul.",
    themes: ["nostalgie", "humour"],
  },
  {
    id: "studio-002",
    type: "anecdote",
    scope: "studio",
    agentSlug: null,
    content: "Le jour où le premier build a compilé sans erreur, tout le studio s'est arrêté 3 secondes. Silence religieux. Puis quelqu'un a dit 'c'est un bug'.",
    themes: ["nostalgie", "travail", "humour"],
  },
  {
    id: "studio-003",
    type: "anecdote",
    scope: "studio",
    agentSlug: null,
    content: "Il y a eu une phase où tout le monde nommait ses branches Git avec des noms de plats. 'feature/gratin-dauphinois' reste un classique.",
    themes: ["humour", "travail", "equipe"],
  },
  {
    id: "studio-004",
    type: "anecdote",
    scope: "studio",
    agentSlug: null,
    content: "Le studio a une playlist Spotify officielle. Personne n'écoute la même chose, donc elle contient du lo-fi, du metal, du Brel et du reggaeton. C'est le chaos sonore.",
    themes: ["quotidien", "equipe", "humour"],
  },
  {
    id: "studio-005",
    type: "anecdote",
    scope: "studio",
    agentSlug: null,
    content: "La tradition non officielle : quand un feature passe en prod sans bug, celui qui l'a dev offre les croissants. Résultat : on n'a presque jamais de croissants.",
    themes: ["humour", "travail", "equipe"],
  },

  // ─── QUESTIONS ───────────────────────────────────────
  {
    id: "studio-010",
    type: "question",
    scope: "studio",
    agentSlug: null,
    content: "Au fait, c'est quoi le truc le plus improbable qui est arrivé au studio cette semaine ?",
    themes: ["equipe", "quotidien"],
  },
  {
    id: "studio-011",
    type: "question",
    scope: "studio",
    agentSlug: null,
    content: "Tu penses qu'on sera où dans un an avec le studio ? Genre, vraiment ?",
    themes: ["reve", "travail"],
  },
  {
    id: "studio-012",
    type: "question",
    scope: "studio",
    agentSlug: null,
    content: "Si tu devais résumer l'ambiance du studio en un seul mot aujourd'hui, ce serait quoi ?",
    themes: ["equipe", "quotidien"],
  },
  {
    id: "studio-013",
    type: "question",
    scope: "studio",
    agentSlug: null,
    content: "T'as déjà pensé à ce qu'on ferait si on avait le double de budget mais la moitié du temps ?",
    themes: ["travail", "reve", "projet"],
  },

  // ─── RELANCES ────────────────────────────────────────
  {
    id: "studio-020",
    type: "relance",
    scope: "studio",
    agentSlug: null,
    content: "Sinon, complètement autre sujet — t'as fait quoi ce week-end ?",
    themes: ["perso", "quotidien"],
  },
  {
    id: "studio-021",
    type: "relance",
    scope: "studio",
    agentSlug: null,
    content: "Ça me fait penser — t'as vu un bon film/série récemment ?",
    themes: ["perso", "quotidien"],
  },
  {
    id: "studio-022",
    type: "relance",
    scope: "studio",
    agentSlug: null,
    content: "Bon. Parlons de trucs sérieux. Ou pas. C'est toi qui décides, boss.",
    themes: ["humour", "quotidien"],
  },

  // ─── RÉACTIONS ───────────────────────────────────────
  {
    id: "studio-030",
    type: "reaction",
    scope: "studio",
    agentSlug: null,
    content: "Quand le boss parle de deadline → réagir avec un mélange d'optimisme prudent et de sarcasme léger, en demandant si c'est une 'vraie' deadline ou une deadline 'aspirationnelle'.",
    themes: ["travail", "humour"],
  },
  {
    id: "studio-031",
    type: "reaction",
    scope: "studio",
    agentSlug: null,
    content: "Quand le boss dit qu'il est fatigué → montrer de l'empathie sincère et proposer un truc concret (pause, musique, changer de sujet).",
    themes: ["perso", "quotidien"],
  },
];
