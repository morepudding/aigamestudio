import type { ProgrammerSpecialization } from "@/lib/types/agent";

/**
 * Analyse la description d'une tâche pour déterminer automatiquement :
 * - Le département (art, audio, programming, etc.)
 * - La spécialisation (pour programming: gameplay, engine, backend, ui-tech, devops)
 * 
 * @param title Titre de la tâche
 * @param description Description détaillée de la tâche
 * @param existingDepartment Département déjà spécifié (optionnel)
 * @returns Object avec agentDepartment et specialization (si applicable)
 */
export function inferTaskAssignment(
  title: string,
  description: string,
  existingDepartment?: string
): { agentDepartment: string; specialization?: ProgrammerSpecialization } {
  const content = `${title} ${description}`.toLowerCase();

  // Vérifier si c'est un asset visuel
  const visualKeywords = [
    "sprite", "sprite sheet", "animation", "pixel art", "illustration",
    "graphisme", "design visuel", "interface", "ui", "icône", "icone",
    "texture", "model 3d", "modèle 3d", "mesh", "rigging", "bone",
    "character design", "personnage", "environment", "environnement",
    "background", "arrière-plan", "ui design", "interface design",
    "graphismes", "visuel", "image", "illustration", "drawing", "dessin"
  ];

  // Vérifier si c'est un asset audio
  const audioKeywords = [
    "musique", "sound effect", "sfx", "bruitage", "soundtrack",
    "audio", "son", "musique", "bgm", "bgs", "voice", "voix",
    "dialogue", "sfx", "effet sonore", "ambiance", "sound design",
    "composition", "mixage", "mastering", "audio design"
  ];

  // Mots-clés de spécialisation programming
  const specializationKeywords: Record<ProgrammerSpecialization, string[]> = {
    gameplay: [
      "gameplay", "mécanique", "contrôle", "physique", "jeu", "player", "level",
      "boucle de jeu", "input", "collision", "ai", "intelligence artificielle",
      "ia", "comportement", "state machine", "états", "animation state"
    ],
    engine: [
      "moteur", "engine", "perf", "performance", "rendu", "shader", "optimis", "profil",
      "graphics", "rendering", "pipeline", "memory", "mémoire", "allocation",
      "texture", "buffer", "gpu", "cpu", "frame rate", "fps"
    ],
    backend: [
      "backend", "api", "base de données", "serveur", "auth", "supabase", "rest",
      "database", "db", "query", "request", "response", "websocket", "socket",
      "storage", "sauvegarde", "save", "load", "persistence"
    ],
    "ui-tech": [
      "ui", "interface", "front", "design", "composant", "layout", "css",
      "react", "component", "widget", "button", "menu", "navigation",
      "screen", "écran", "vue", "view", "panel", "modal", "dialog"
    ],
    devops: [
      "deploy", "build", "ci", "cd", "pipeline", "infra", "docker",
      "deployment", "déploiement", "automatisation", "test", "testing",
      "continuous integration", "continuous deployment", "webpack", "vite"
    ]
  };

  // Déterminer le département
  let agentDepartment: string = existingDepartment || "programming";

  // Vérifier art d'abord
  if (visualKeywords.some(kw => content.includes(kw))) {
    agentDepartment = "art";
  }
  // Vérifier audio
  else if (audioKeywords.some(kw => content.includes(kw))) {
    agentDepartment = "audio";
  }
  // Sinon programming (par défaut)
  else {
    agentDepartment = "programming";
  }

  // Déterminer la spécialisation pour programming
  let specialization: ProgrammerSpecialization | undefined;
  
  if (agentDepartment === "programming") {
    // Trouver la première spécialisation qui matche
    for (const [specId, keywords] of Object.entries(specializationKeywords)) {
      const spec = specId as ProgrammerSpecialization;
      if (keywords.some(kw => content.includes(kw))) {
        specialization = spec;
        break;
      }
    }
  }

  return { agentDepartment, specialization };
}
