export type MomentVivantType =
  | "pause-café"
  | "drague"
  | "complicité"
  | "petite-friction"
  | "confidence";

/** Seed généré à la création — stocké en JSONB dans la colonne `scene` */
export interface MomentVivantSeed {
  /** Description riche de la scène (contexte LLM pour tous les échanges suivants) */
  situationContext: string;
  /** Nombre total d'échanges visé (typiquement 4-5) */
  totalExchanges: number;
  /** Première ligne de l'agent dans le moment */
  firstReplique: string;
  /** Trois choix pour la première réponse du joueur */
  firstChoices: [string, string, string];
}

/** Retour de l'endpoint /continue */
export interface MomentVivantContinuation {
  /** Réponse complète de l'agent (réagit au choix + lance le prochain beat, ou clôt) */
  agentResponse: string;
  /** Prochains choix pour le joueur (null si clôture) */
  nextChoices: [string, string, string] | null;
  /** Dernier échange ou pas */
  isFinal: boolean;
}

export interface MomentVivantScenario {
  id: string;
  agentSlug: string;
  momentType: MomentVivantType;
  messageOuverture: string;
  scene: MomentVivantSeed;
  status: "pending" | "sent" | "opened" | "completed" | "expired";
  chatMessageId: string | null;
  scheduledAt: string;
  openedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Ce que le joueur a joué — pour générer la mémoire finale */
export interface MomentVivantPlaythrough {
  agentSlug: string;
  agentName: string;
  momentType: MomentVivantType;
  exchanges: Array<{
    replique: string;
    choixJoueur: string;
    reponseAgent: string;
  }>;
}
