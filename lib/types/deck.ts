/**
 * Système de Deck conversationnel (style JDR solo).
 * Les agents piochent dans un deck de cartes pré-écrites
 * au lieu d'halluciner des anecdotes/souvenirs.
 */

/** Types de cartes disponibles dans un deck */
export type DeckCardType =
  | "anecdote"    // Souvenir/histoire que l'agent peut raconter
  | "question"    // Question à poser au boss pour relancer
  | "relance"     // Sujet/réaction pour changer de thème
  | "reaction";   // Réaction type à un thème donné

/** Portée d'une carte */
export type DeckScope = "studio" | "agent";

/** Thèmes possibles pour le filtrage contextuel */
export type DeckTheme =
  | "travail"
  | "perso"
  | "humour"
  | "nostalgie"
  | "projet"
  | "equipe"
  | "reve"
  | "quotidien";

/** Une carte du deck */
export interface DeckCard {
  id: string;
  type: DeckCardType;
  scope: DeckScope;
  /** Slug de l'agent (null = carte studio globale) */
  agentSlug: string | null;
  /** Le contenu de la carte — ce que l'IA peut utiliser/adapter */
  content: string;
  /** Thèmes associés pour pioche contextuelle */
  themes: DeckTheme[];
  /** Confiance minimum requise pour jouer cette carte (0-100) */
  minConfidence?: number;
  /** Carte déjà utilisée dans cette conversation ? (runtime) */
  used?: boolean;
}

/** Un deck complet (studio ou agent) */
export interface Deck {
  scope: DeckScope;
  agentSlug: string | null;
  cards: DeckCard[];
}
