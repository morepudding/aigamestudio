import { DeckCard, DeckTheme } from "@/lib/types/deck";
import { STUDIO_DECK } from "@/lib/data/decks/studio";
import { EVE_DECK } from "@/lib/data/decks/eve";

/** Registry des decks par agent slug */
const AGENT_DECKS: Record<string, DeckCard[]> = {
  eve: EVE_DECK,
};

/**
 * Récupère toutes les cartes disponibles pour un agent
 * (deck studio + deck perso de l'agent).
 */
export function getAvailableCards(
  agentSlug: string,
  confidenceLevel: number = 0,
): DeckCard[] {
  const agentDeck = AGENT_DECKS[agentSlug] ?? [];
  const allCards = [...STUDIO_DECK, ...agentDeck];

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
  } = {},
): DeckCard[] {
  const { confidenceLevel = 0, recentThemes = [], usedCardIds = [] } = options;

  let available = getAvailableCards(agentSlug, confidenceLevel);

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
