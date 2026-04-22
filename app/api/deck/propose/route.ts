import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import { DeckCardType, DeckTheme } from "@/lib/types/deck";
import { getAvailableCards } from "@/lib/services/deckService";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const CARD_TYPES: DeckCardType[] = ["anecdote", "question", "relance", "reaction"];
const ALL_THEMES: DeckTheme[] = [
  "travail", "perso", "humour", "nostalgie", "projet", "equipe", "reve", "quotidien",
];

const TYPE_LABELS: Record<DeckCardType, string> = {
  anecdote: "anecdote (souvenir ou histoire partagée de la vie du studio)",
  question: "question (à poser au boss pour relancer la conversation)",
  relance: "relance (sujet ou accroche pour changer de direction)",
  reaction: "réaction (façon type de réagir à une situation précise)",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function parseCard(raw: string) {
  const jsonText = raw.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(jsonText) as {
    type: DeckCardType;
    content: string;
    themes: DeckTheme[];
    minConfidence: number;
  };
}

// ── route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { agentSlug, cardType } = await req.json();
  if (!agentSlug) return NextResponse.json({ error: "agentSlug required" }, { status: 400 });

  const isStudio = agentSlug === "studio";

  const targetType: DeckCardType = (CARD_TYPES.includes(cardType) ? cardType : null) ??
    CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];

  const typeDescription = TYPE_LABELS[targetType];

  // ── Existing cards (dedup) ─────────────────────────────────────────────────
  const existingStatic = getAvailableCards(agentSlug).map((c) => c.content.slice(0, 80));
  const { data: dbCards } = await supabaseAdmin
    .from("agent_deck_cards")
    .select("content")
    .eq("agent_slug", agentSlug)
    .eq("accepted", true);
  const existingDb = (dbCards ?? []).map((c: { content: string }) => c.content.slice(0, 80));
  const existingSnippets = [...existingStatic, ...existingDb];

  const dedupLine = existingSnippets.length > 0
    ? `Cartes déjà existantes (évite les doublons) :\n${existingSnippets.slice(0, 15).map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`
    : "";

  // ── Studio deck ────────────────────────────────────────────────────────────
  if (isStudio) {
    const systemPrompt = `Tu es un auteur de contenu pour un jeu de simulation de studio de jeu vidéo.
Tu dois écrire UNE nouvelle carte de deck conversationnel PARTAGÉE par tous les agents d'Eden Studio.

CONTEXTE DU STUDIO :
- Eden Studio développe des mini-jeux web pour l'Université des Espions (Academia Vespana), un visual novel.
- Le boss du studio s'appelle Romain. Il est Producteur.
- Eve est la Propriétaire du studio.
- L'ambiance est sérieuse mais humaine, avec de l'humour noir et une vraie camaraderie.

TYPE DE CARTE À CRÉER : ${typeDescription}

RÈGLES :
1. La carte doit être utilisable par N'IMPORTE QUEL agent du studio, indépendamment de sa personnalité.
2. Elle doit parler de la VIE DU STUDIO (anecdotes collectives, culture, souvenirs communs) ou de dinamiques avec le boss.
3. Ton neutre-drole, universel — pas d'anecdote perso d'un agent spécifique.
4. Pour les anecdotes : événement vécu au studio, incident de prod, tradition bizarre, etc.
5. Pour les relances / questions : sujets naturels entre collègues d'un studio indé.
6. Longueur : 15 à 50 mots.

RÉPONDRE EN JSON STRICT (sans markdown) :
{
  "type": "${targetType}",
  "content": "...",
  "themes": ["thème1", "thème2"],
  "minConfidence": 0
}

Thèmes disponibles : ${ALL_THEMES.join(", ")}
minConfidence : toujours 0 pour les cartes studio`;

    const result = await callOpenRouter(
      LLM_MODELS.tasks,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${dedupLine}Génère une carte studio originale.` },
      ],
      { temperature: 0.9, max_tokens: 300 }
    );

    let parsed;
    try {
      parsed = parseCard(result.content);
    } catch {
      return NextResponse.json({ error: "Failed to parse LLM response", raw: result.content }, { status: 500 });
    }

    if (!parsed.content || !CARD_TYPES.includes(parsed.type)) {
      return NextResponse.json({ error: "Invalid card data from LLM", raw: result.content }, { status: 500 });
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("agent_deck_cards")
      .insert({
        agent_slug: "studio",
        card_type: parsed.type,
        scope: "studio",
        content: parsed.content,
        themes: Array.isArray(parsed.themes) ? parsed.themes.filter((t: string) => ALL_THEMES.includes(t as DeckTheme)) : [],
        min_confidence: 0,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
    }

    return NextResponse.json({ card: inserted });
  }

  // ── Agent deck ─────────────────────────────────────────────────────────────
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from("agents")
    .select("name, role, backstory, personality_primary, personality_nuance, personality_extras, personality_bio, gender")
    .eq("slug", agentSlug)
    .single();

  if (agentErr || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const systemPrompt = `Tu es un auteur de contenu pour un jeu de simulation de studio de jeu vidéo.
Tu dois écrire UNE nouvelle carte de deck conversationnel pour l'agent ${agent.name}.

PERSONNAGE :
- Nom : ${agent.name}
- Rôle : ${agent.role}
- Genre : ${agent.gender}
- Personnalité principale : ${agent.personality_primary}${agent.personality_nuance ? ` / nuance : ${agent.personality_nuance}` : ""}${agent.personality_extras ? ` / extras : ${agent.personality_extras}` : ""}
- Backstory : ${agent.backstory}
${agent.personality_bio ? `- Bio personnalité : ${agent.personality_bio}` : ""}

TYPE DE CARTE À CRÉER : ${typeDescription}

RÈGLES :
1. La carte doit sonner comme si ${agent.name} parlait en conversation directe avec son patron (le boss du studio).
2. Le contenu doit être court, naturel, et spécifique à la personnalité de l'agent.
3. Pour les anecdotes : une histoire courte et concrète de la vie perso de ${agent.name}.
4. Pour les questions : une question directe, candide, que l'agent serait vraiment curieux de poser.
5. Pour les relances : une phrase pour changer de sujet naturellement.
6. Pour les réactions : décrire comment l'agent réagit à une situation type (format "Quand X → faire Y").
7. Longueur : 15 à 50 mots maximum pour le contenu.

RÉPONDRE EN JSON STRICT (sans markdown) :
{
  "type": "${targetType}",
  "content": "...",
  "themes": ["thème1", "thème2"],
  "minConfidence": 0
}

Thèmes disponibles : ${ALL_THEMES.join(", ")}
minConfidence : 0 (carte dispo dès le début) ou 30 (confiance modérée) ou 60 (grande confiance)`;

  const result = await callOpenRouter(
    LLM_MODELS.tasks,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${dedupLine}Génère une carte originale pour ${agent.name}.` },
    ],
    { temperature: 0.9, max_tokens: 300 }
  );

  let parsed;
  try {
    parsed = parseCard(result.content);
  } catch {
    return NextResponse.json({ error: "Failed to parse LLM response", raw: result.content }, { status: 500 });
  }

  if (!parsed.content || !CARD_TYPES.includes(parsed.type)) {
    return NextResponse.json({ error: "Invalid card data from LLM", raw: result.content }, { status: 500 });
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("agent_deck_cards")
    .insert({
      agent_slug: agentSlug,
      card_type: parsed.type,
      scope: "agent",
      content: parsed.content,
      themes: Array.isArray(parsed.themes) ? parsed.themes.filter((t: string) => ALL_THEMES.includes(t as DeckTheme)) : [],
      min_confidence: [0, 30, 60].includes(parsed.minConfidence) ? parsed.minConfidence : 0,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
  }

  return NextResponse.json({ card: inserted });
}
