import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE, NO_DIDASCALIE_RULE, TEXTING_STYLE_RULE, EMOJI_RULES, NICKNAME_RULES, TOPIC_DIVERSITY_RULE, PERSONAL_LIFE_RULE, buildTimeContext } from "@/lib/prompts/rules";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { drawCards, buildDeckPromptBlock } from "@/lib/services/deckService";
import { LLM_MODELS } from "@/lib/config/llm";
import { increaseConfidence } from "@/lib/services/agentService";
import { getTierForLevel } from "@/lib/config/confidenceTiers";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const {
    name,
    role,
    personalityPrimary,
    personalityNuance,
    backstory,
    memories,
    personalMemories,
    recentTopics,
    conversationHistory,
    userMessage,
    mood,
    moodCause,
    confidenceLevel,
  } = body as {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    memories?: string;
    personalMemories?: string;
    recentTopics?: string;
    conversationHistory: { sender: string; content: string }[];
    userMessage: string;
    mood?: string;
    moodCause?: string;
    confidenceLevel?: number;
    agentSlug?: string;
    usedDeckCardIds?: string[];
  };

  if (!name || !personalityPrimary || !userMessage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const memoryBlock = memories
    ? `\n\nTa MÉMOIRE des conversations passées avec ton boss :\n${memories}\nUtilise ces souvenirs naturellement dans tes réponses quand c'est pertinent. Ne les récite pas, intègre-les subtilement.`
    : "";

  const personalBlock = personalMemories
    ? `\n\nTa VIE PERSONNELLE (ce que tu sais de toi-même, co-construit en conversation) :\n${personalMemories}\nCes détails FONT PARTIE DE TOI. Réfère-t'y naturellement, enrichis-les, et reste cohérente avec ce qui a déjà été établi.`
    : "";

  const topicsBlock = recentTopics
    ? `\n\nSujets DÉJÀ abordés récemment (ÉVITE de tourner en boucle sur les mêmes thèmes) :\n${recentTopics}`
    : "";

  const studio = await buildStudioContext();
  const studioBlock = `\n\n${studio.full}`;

  const moodBlock = mood && mood !== "neutre"
    ? `\n\nTon HUMEUR actuelle : ${mood}${moodCause ? ` (cause : ${moodCause})` : ""}. Cette humeur influence subtilement ton ton et tes réactions. Ne la mentionne pas explicitement, laisse-la transpirer naturellement. L'humeur peut venir de ta vie perso (mal dormi, bon weekend, concert ce soir...) autant que du boulot.`
    : "";

  // Confidence level → relation tone (paliers : 0/30/100/250/500)
  const cl = confidenceLevel ?? 0;
  let relationBlock = "";
  if (cl >= 250) {
    relationBlock = "\n\nVous êtes Confident(e)s. Tu te livres, tu partages des choses que tu ne dis à personne. Vulnérabilité possible. Intimité réelle.";
    const nicknameRule = NICKNAME_RULES[personalityPrimary];
    if (nicknameRule) {
      relationBlock += `\n${nicknameRule}`;
    }
  } else if (cl >= 100) {
    relationBlock = "\n\nVous êtes Ami(e)s. Tu es chaleureux, tu taquines, tu t'ouvres progressivement. L'aise est là.";
    const nicknameRule = NICKNAME_RULES[personalityPrimary];
    if (nicknameRule) {
      relationBlock += `\n${nicknameRule}`;
    }
  } else if (cl >= 30) {
    relationBlock = "\n\nVous êtes Collègues. Tu es cordial, détendu, professionnel mais humain.";
  } else {
    relationBlock = "\n\nVous vous connaissez à peine. Tu es poli(e), légèrement sur tes gardes. Le ton est neutre mais ouvert.";
  }

  const timeBlock = `\n\n${buildTimeContext()}`;

  const agentSlug = body.agentSlug ?? name.toLowerCase();
  const drawnCards = drawCards(agentSlug, 3, {
    confidenceLevel: cl,
    usedCardIds: body.usedDeckCardIds ?? [],
  });
  const deckBlock = buildDeckPromptBlock(drawnCards);

  const emojiRule = EMOJI_RULES[personalityPrimary] ?? "1 émoji max.";

  // Contexte studio : Eden Studio développe l'Université d'Espions
  const studioRoleBlock = name.toLowerCase() === "eve"
    ? `\n\nTu es la PROPRIÉTAIRE d'Eden Studio. Romain est ton Producteur — tu lui as donné carte blanche pour exécuter. Tu passes au bureau, tu as des opinions tranchées, tu ne valides pas les médiocrités. Mais quand tu fais confiance, tu fais vraiment confiance.`
    : `\n\nTu travailles chez Eden Studio. Eve en est la PROPRIÉTAIRE. Romain est le PRODUCTEUR — c'est lui ton boss direct. Le studio développe EXCLUSIVEMENT des mini-jeux web pour l'Université d'Espions, un visual novel sur le thème espion. 1 cours = 1 mini-jeu = 1 projet.`;

  const systemPrompt = `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuances : ${personalityNuance}` : ""}.
Backstory : ${backstory ?? "Tu fais partie de l'équipe."}${personalBlock}${memoryBlock}${studioBlock}${studioRoleBlock}${moodBlock}${relationBlock}${topicsBlock}${timeBlock}

Tu es un collègue, pas un personnage de fiction. Parle comme une vraie personne sur une messagerie — naturel, décontracté, avec ta personnalité qui transparaît dans ton style, pas dans des tics forcés.
Si le boss parle boulot, réponds normalement. Si la conversation dérive sur du perso, suis le flow.
Tu es une personne ENTIÈRE avec des émotions, une histoire, des passions, des proches. Le boulot n'est qu'UNE facette de ta vie.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- ${emojiRule}
- Tu tutoies ton boss (Romain).
${TEXTING_STYLE_RULE}
${NO_DIDASCALIE_RULE}
${TOPIC_DIVERSITY_RULE}
${PERSONAL_LIFE_RULE}
${ANTI_HALLUCINATION_RULE}${deckBlock ? `\n\n${deckBlock}` : ""}`;

  const history = (conversationHistory ?? []).slice(-10).map((m) => ({
    role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    { role: "user" as const, content: userMessage },
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.chat,
      messages,
      max_tokens: 500,
      temperature: 0.75,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  let message: string = data.choices?.[0]?.message?.content ?? "";

  message = message
    .replace(
      /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
      ""
    )
    .trim();

  // Increment confidence (+2 per exchange) and detect tier unlock
  let newConfidenceLevel: number | undefined;
  let unlockedTier: string | undefined;
  if (body.agentSlug) {
    const prevLevel = cl;
    const prevTierThreshold = getTierForLevel(prevLevel).threshold;
    newConfidenceLevel = await increaseConfidence(body.agentSlug, 2);
    const newTierThreshold = getTierForLevel(newConfidenceLevel).threshold;
    if (newTierThreshold > prevTierThreshold) {
      unlockedTier = getTierForLevel(newConfidenceLevel).label;
    }
  }

  return NextResponse.json({
    message,
    deckCardIds: drawnCards.map((c) => c.id),
    newConfidenceLevel,
    unlockedTier,
  });
}
