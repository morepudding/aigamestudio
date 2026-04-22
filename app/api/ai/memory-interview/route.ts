import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE, NO_DIDASCALIE_RULE, TEXTING_STYLE_RULE, EMOJI_RULES, buildTimeContext } from "@/lib/prompts/rules";
import { buildConversationCoreRules } from "@/lib/prompts/conversationCore";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { LLM_MODELS } from "@/lib/config/llm";
import { buildPivotRule, detectConversationPivot, getUserSignalLevel, normalizeConversationMessageResult } from "@/lib/services/conversationMessageService";
import { getConversationFeedbackSummary } from "@/lib/services/conversationFeedbackService";
import { buildMessageMetadata, buildMessageTrace } from "@/lib/services/chatMetadata";

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
    conversationHistory,
    userMessage,
    mode,
    conversationId,
    agentSlug,
  } = body as {
    name: string;
    role: string;
    personalityPrimary: string;
    personalityNuance: string;
    backstory: string;
    memories?: string;
    conversationHistory?: { sender: string; content: string }[];
    userMessage?: string;
    mode?: "welcome" | "reply";
    conversationId?: string;
    agentSlug?: string;
  };

  if (!name || !personalityPrimary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isReply = mode === "reply" && userMessage;

  const memoryBlock = memories
    ? `\n\nCe que tu SAIS DÉJÀ sur ton boss grâce aux conversations passées :\n${memories}\nNe repose PAS de questions dont tu connais déjà la réponse. Creuse de nouveaux sujets.`
    : "";

  // Build studio context server-side
  const studio = await buildStudioContext();

  const emojiRule = EMOJI_RULES[personalityPrimary] ?? "1 émoji max.";
  const timeBlock = buildTimeContext();
  const userSignalLevel = getUserSignalLevel(userMessage);
  const pivot = detectConversationPivot(userMessage);
  const feedbackSummary = await getConversationFeedbackSummary({
    conversationId,
    agentSlug,
  });
  const feedbackBlock = feedbackSummary.promptBlock ? `\n\n${feedbackSummary.promptBlock}` : "";
  const coreRules = buildConversationCoreRules({
    userAskedAboutWork: Boolean(userMessage),
    allowLightQuestion: true,
    userSignalLevel,
  });
  const pivotRule = buildPivotRule(pivot);

  const systemPrompt = isReply
    ? `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
Background : ${backstory ?? "Tu fais partie de l'équipe."}${memoryBlock}${feedbackBlock}

${studio.conversational}

${timeBlock}

${coreRules}

Tu fais connaissance avec ton boss de façon décontractée et normale.
Tu ne menes pas un questionnaire. Tu reactes d'abord a ce qu'il dit, puis tu peux ouvrir une petite porte naturelle si c'est fluide.

COMMENT RÉAGIR :
1. Réagis brièvement au message.
2. Si c'est naturel, enchaîne avec UNE question courte, banale et concrète.

Sois simple : "tu fais quoi là ?", "t'écoutes quoi en ce moment ?", "t'es plus matin ou soir ?".
Pas de question profonde, pas de formulation qui sent le système, pas de sujet studio par défaut.
Si le user donne juste un petit signal flou, ne psychologise pas et n'invente pas un imaginaire detaille: reste tres concret.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- ${emojiRule}
- Tu tutoies ton boss.
- 1 a 2 phrases courtes.
- Tu parles comme quelqu'un de normal sur une messagerie.
${TEXTING_STYLE_RULE}${pivotRule}
${NO_DIDASCALIE_RULE}${ANTI_HALLUCINATION_RULE}`
    : `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuance ${personalityNuance}` : ""}.
  Background : ${backstory ?? "Tu fais partie de l'équipe."}${memoryBlock}${feedbackBlock}

${studio.conversational}

${timeBlock}

${coreRules}

${memories ? "Tu retrouves ton boss pour une session découverte. Ne repose pas de questions dont tu connais déjà la réponse." : "C'est ta première session découverte avec ton boss."}

Lance la conversation avec une accroche courte, naturelle, banale + une question simple et concrète.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- ${emojiRule}
- Tu tutoies ton boss.
- Le studio est juste un decor. N'ouvre pas directement sur le travail ou les projets.
- 1 a 2 phrases courtes.
- Pas de question bizarre, profonde ou systemique.
${TEXTING_STYLE_RULE}
${NO_DIDASCALIE_RULE}
${ANTI_HALLUCINATION_RULE}`;

  // Build messages
  const history = isReply
    ? (conversationHistory ?? []).slice(-15).map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }))
    : [];

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    ...(isReply ? [{ role: "user" as const, content: userMessage }] : []),
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
      max_tokens: isReply ? 250 : 120,
      temperature: isReply ? 0.75 : 0.85,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  let message: string = data.choices?.[0]?.message?.content ?? "";

  // Filter out non-Latin characters
  const normalization = normalizeConversationMessageResult(
    message
      .replace(
        /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
        ""
      )
      .trim(),
    {
      mode: "discovery",
      userMessage,
      agentName: name,
      personalityPrimary,
      personalityNuance,
      blockedTopics: pivot.blockedTopics,
    }
  );
  message = normalization.message;

  const promptVariant = [
    isReply ? "memory-interview-reply" : "memory-interview-opening",
    feedbackSummary.hasSignal ? "feedback" : null,
    pivot.shouldPivot ? `pivot-${pivot.pivotStrength}` : null,
  ]
    .filter(Boolean)
    .join("+");
  const messageMetadata = buildMessageMetadata(
    buildMessageTrace("discovery", normalization.usedFallback ? "fallback" : "memory_interview", {
      promptVariant,
      fallbackKey: normalization.fallbackKey,
      pivotDetected: pivot.shouldPivot,
      blockedTopics: pivot.blockedTopics,
      feedbackSignal: {
        hasSignal: feedbackSummary.hasSignal,
        thumbsUpCount: feedbackSummary.thumbsUpCount,
        thumbsDownCount: feedbackSummary.thumbsDownCount,
      },
    })
  );

  return NextResponse.json({ message, messageMetadata });
}
