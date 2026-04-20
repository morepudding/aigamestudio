import { DeckCard, DeckCardType, DeckScope, DeckTheme } from "@/lib/types/deck";
import { STUDIO_DECK } from "@/lib/data/decks/studio";
import { EVE_DECK } from "@/lib/data/decks/eve";
import { supabase } from "@/lib/supabase/client";

/** Registry des decks par agent slug */
const AGENT_DECKS: Record<string, DeckCard[]> = {
  eve: EVE_DECK,
};

/**
 * Charge les cartes validées (accepted = true) depuis la DB pour un agent
 * ou pour le studio (agentSlug = "studio").
 */
export async function fetchAcceptedDbCards(agentSlug: string): Promise<DeckCard[]> {
  const { data } = await supabase
    .from("agent_deck_cards")
    .select("id, card_type, scope, agent_slug, content, themes, min_confidence")
    .eq("accepted", true)
    .eq("agent_slug", agentSlug);

  return (data ?? []).map((row: {
    id: string;
    card_type: string;
    scope: string;
    agent_slug: string;
    content: string;
    themes: string[];
    min_confidence: number;
  }) => ({
    id: row.id,
    type: row.card_type as DeckCardType,
    scope: row.scope as DeckScope,
    agentSlug: row.agent_slug,
    content: row.content,
    themes: row.themes as DeckTheme[],
    minConfidence: row.min_confidence,
  }));
}

/**
 * Récupère toutes les cartes disponibles pour un agent
 * (deck studio + deck perso de l'agent + cartes DB validées).
 */
export function getAvailableCards(
  agentSlug: string,
  confidenceLevel: number = 0,
  extraCards: DeckCard[] = [],
): DeckCard[] {
  const agentDeck = AGENT_DECKS[agentSlug] ?? [];
  // "studio" slug = pas de deck agent statique, juste studio + DB
  const staticCards = agentSlug === "studio"
    ? [...STUDIO_DECK]
    : [...STUDIO_DECK, ...agentDeck];

  const allCards = [...staticCards, ...extraCards];

  return allCards.filter((card) => {
    if (card.minConfidence && confidenceLevel < card.minConfidence) return false;
    return true;
  });
}

/**
 * Pioche N cartes aléatoires du deck, avec pondération contextuelle.
 * Privilégie les cartes dont les thèmes matchent les sujets récents.
 */
export function drawCards(
  agentSlug: string,
  count: number = 2,
  options: {
    confidenceLevel?: number;
    recentThemes?: DeckTheme[];
    usedCardIds?: string[];
    extraCards?: DeckCard[];
  } = {},
): DeckCard[] {
  const { confidenceLevel = 0, recentThemes = [], usedCardIds = [], extraCards = [] } = options;

  let available = getAvailableCards(agentSlug, confidenceLevel, extraCards);

  // Exclure les cartes déjà utilisées dans cette conversation
  if (usedCardIds.length > 0) {
    available = available.filter((c) => !usedCardIds.includes(c.id));
  }

  if (available.length === 0) return [];

  // Pondération : les cartes dont les thèmes matchent les sujets récents
  // ont plus de chances d'être piochées
  const weighted = available.map((card) => {
    let weight = 1;
    if (recentThemes.length > 0) {
      const matchCount = card.themes.filter((t) =>
        recentThemes.includes(t),
      ).length;
      weight += matchCount * 2;
    }
    // Les questions et relances sont légèrement favorisées
    // (elles créent de l'engagement)
    if (card.type === "question" || card.type === "relance") {
      weight += 1;
    }
    return { card, weight };
  });

  // Pioche pondérée sans remplacement
  const drawn: DeckCard[] = [];
  const pool = [...weighted];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const totalWeight = pool.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < pool.length; j++) {
      random -= pool[j].weight;
      if (random <= 0) {
        drawn.push(pool[j].card);
        pool.splice(j, 1);
        break;
      }
    }
  }

  return drawn;
}

/**
 * Construit le bloc de prompt à injecter dans le system prompt
 * avec les cartes piochées.
 */
export function buildDeckPromptBlock(cards: DeckCard[]): string {
  if (cards.length === 0) return "";

  const cardDescriptions = cards.map((card, i) => {
    const typeLabel = {
      anecdote: "💬 Anecdote",
      question: "❓ Question à poser",
      relance: "🔄 Relance",
      reaction: "⚡ Réaction",
    }[card.type];

    return `${i + 1}. ${typeLabel}: ${card.content}`;
  });

  return `
DECK CONVERSATIONNEL — Éléments à ta disposition :
${cardDescriptions.join("\n")}

RÈGLES DU DECK :
- Tu as ces éléments comme MATÉRIEL de conversation. Utilises-en MAXIMUM UN par message, et SEULEMENT si ça s'intègre naturellement.
- ADAPTE le contenu à ta personnalité et au contexte. Ne récite pas mot pour mot — reformule, abrège, rends-le naturel.
- Si aucun élément ne colle à la conversation actuelle, IGNORE-LES. Mieux vaut ne rien utiliser que forcer.
- Les questions et relances servent à REBONDIR quand la conversation stagne.
- N'INVENTE PAS d'anecdotes en dehors de ce deck et de ta VIE PERSONNELLE connue. Si tu n'as pas de matériel qui colle, pose une question au boss.`;
}
