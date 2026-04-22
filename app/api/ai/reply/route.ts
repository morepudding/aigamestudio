import { NextRequest, NextResponse } from "next/server";
import { ANTI_HALLUCINATION_RULE, NO_DIDASCALIE_RULE, NO_UNSOLICITED_PITCH_RULE, TEXTING_STYLE_RULE, EMOJI_RULES, NICKNAME_RULES, TOPIC_DIVERSITY_RULE, PERSONAL_LIFE_RULE, buildTimeContext, buildAntiRepeatBlock } from "@/lib/prompts/rules";
import { buildConversationCoreRules, buildTopicTintBlock } from "@/lib/prompts/conversationCore";
import { buildStudioContext } from "@/lib/services/studioContextService";
import { LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { increaseConfidence } from "@/lib/services/agentService";
import { getTierForLevel } from "@/lib/config/confidenceTiers";
import { topicReservoirService } from "@/lib/services/topicReservoirService";
import { scenarioHistoryService } from "@/lib/services/scenarioHistoryService";
import { buildMessageMetadata, buildMessageTrace } from "@/lib/services/chatMetadata";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPivotRule, detectConversationPivot, getUserSignalLevel, normalizeConversationMessageResult, userTriggeredProfessionalTopic } from "@/lib/services/conversationMessageService";
import { getConversationFeedbackSummary } from "@/lib/services/conversationFeedbackService";

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
    modelOverride?: string;
    conversationId?: string;
  };

  if (!name || !personalityPrimary || !userMessage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const memoryBlock = memories
    ? `\n\nMemoire utile :\n${memories}\nUtilise seulement ce qui aide vraiment a repondre au message.`
    : "";

  const personalBlock = personalMemories
    ? `\n\nVie perso deja etablie :\n${personalMemories}\nReste coherente, sans en faire trop.`
    : "";

  const topicsBlock = recentTopics
    ? `\n\nSujets recents a ne pas repeter en boucle :\n${recentTopics}`
    : "";

  let selectedScenario = null as null | ReturnType<typeof topicReservoirService.getScenarioForAgent>;
  if (body.conversationId) {
    try {
      const usedScenarioIds = await scenarioHistoryService.getUsedScenarioIds(
        body.conversationId,
        getSupabaseAdminClient()
      );

      selectedScenario = topicReservoirService.getScenarioForAgent(
        [personalityPrimary, personalityNuance].filter(Boolean).join(", "),
        confidenceLevel ?? 0,
        usedScenarioIds
      );
    } catch (error) {
      console.error("[reply] Topic reservoir selection failed:", error);
    }
  }

  const scenarioBlock = buildTopicTintBlock(selectedScenario);
  const feedbackSummary = await getConversationFeedbackSummary({
    conversationId: body.conversationId,
    agentSlug: body.agentSlug,
  });
  const feedbackBlock = feedbackSummary.promptBlock ? `\n\n${feedbackSummary.promptBlock}` : "";

  const studio = await buildStudioContext();
  const studioBlock = `\n\n${studio.conversational}`;

  const moodBlock = mood && mood !== "neutre"
    ? `\n\nHumeur actuelle : ${mood}${moodCause ? ` (${moodCause})` : ""}. Laisse-la legerement influencer le ton sans la surjouer.`
    : "";

  // Confidence level → relation tone (paliers : 0/30/100/250/500)
  const cl = confidenceLevel ?? 0;
  let relationBlock = "";
  if (cl >= 250) {
    relationBlock = "\n\nNiveau relationnel : grande confiance. Tu peux etre plus directe, plus ouverte, mais toujours naturelle.";
    const nicknameRule = NICKNAME_RULES[personalityPrimary];
    if (nicknameRule) {
      relationBlock += `\n${nicknameRule}`;
    }
  } else if (cl >= 100) {
    relationBlock = "\n\nNiveau relationnel : relation amicale. Il y a de l'aisance, de la chaleur, un peu de taquinerie possible.";
    const nicknameRule = NICKNAME_RULES[personalityPrimary];
    if (nicknameRule) {
      relationBlock += `\n${nicknameRule}`;
    }
  } else if (cl >= 30) {
    relationBlock = "\n\nNiveau relationnel : collegues a l'aise. Ton cordial, simple, humain.";
  } else {
    relationBlock = "\n\nNiveau relationnel : debut de relation. Ton poli, simple, un peu reserve.";
  }

  const timeBlock = `\n\n${buildTimeContext()}`;

  const recentAgentReplies = (conversationHistory ?? [])
    .filter((m) => m.sender !== "user")
    .slice(-4)
    .map((m) => m.content);
  const antiRepeatBlock = buildAntiRepeatBlock(recentAgentReplies);

  const emojiRule = EMOJI_RULES[personalityPrimary] ?? "1 émoji max.";

  const userAskedAboutWork = userTriggeredProfessionalTopic(userMessage);
  const userSignalLevel = getUserSignalLevel(userMessage);
  const pivot = detectConversationPivot(userMessage);

  const studioRoleBlock = name.toLowerCase() === "eve"
    ? `\n\nTu es Eve. Meme si tu diriges le studio, ici vous pouvez parler comme deux personnes normales.`
    : `\n\nTu connais Romain via le studio, mais vous pouvez parler normalement sans revenir au travail.`;

  const coreRules = buildConversationCoreRules({ userAskedAboutWork, userSignalLevel });
  const pivotRule = buildPivotRule(pivot);

  const systemPrompt = `Tu es ${name}, ${role ?? "membre de l'équipe"} au sein d'Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? `, nuances : ${personalityNuance}` : ""}.
  Backstory : ${backstory ?? "Tu fais partie de l'équipe."}${studioBlock}${studioRoleBlock}${relationBlock}${moodBlock}${memoryBlock}${personalBlock}${topicsBlock}${scenarioBlock}${feedbackBlock}${timeBlock}

${coreRules}
Prefere une reponse simple, utile et plausible.
N'essaie pas d'etre brillante, romanesque ou memorables a tout prix.
Quand c'est naturel, vise plutot une petite reaction + un rebond concret qu'une reponse trop seche.

RÈGLES :
- Français uniquement. Pas de caractères non-latins.
- ${emojiRule}
- Tu tutoies ton boss (Romain).
- Reponds d'abord au message recu, simplement.
- 1 a 3 phrases courtes en general. Le bon equilibre est souvent : une vraie reaction + une petite relance concrete.
- Une seule impulsion claire par message.
- Evite les blocs trop longs, les grandes envoles, les idees bizarres, les pitchs, le jargon tech et les analogies gratuites.
- Evite les reponses trop minimales ou generiques du type "je vois", "raconte", "ah ouais" si tu peux faire un peu mieux sans rallonger.
- N'utilise jamais de placeholders ou crochets de remplissage du type [prenom], [nom], [collegue], [quelque chose].
- N'ecris jamais de fragments narratifs residuels comme "regarde mon telephone" ou "hausse les epaules".
- Si le user a donne peu, reste sobre. Si le user s'est vraiment ouvert, une petite lecture humaine est possible mais reste breve et plausible.
${TEXTING_STYLE_RULE}
${NO_DIDASCALIE_RULE}
${NO_UNSOLICITED_PITCH_RULE}
${TOPIC_DIVERSITY_RULE}
${PERSONAL_LIFE_RULE}
${ANTI_HALLUCINATION_RULE}${antiRepeatBlock}${pivotRule}`;

  const history = (conversationHistory ?? []).slice(-20).map((m) => ({
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
      model: body.modelOverride ?? LLM_MODELS.chat,
      messages,
      max_tokens: LLM_PARAMS.chat.max_tokens,
      temperature: LLM_PARAMS.chat.temperature,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  let message: string = data.choices?.[0]?.message?.content ?? "";

  const normalization = normalizeConversationMessageResult(
    message
      .replace(
        /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
        ""
      )
      .trim(),
    {
      mode: "reply",
      userMessage,
      agentName: name,
      personalityPrimary,
      personalityNuance,
      blockedTopics: pivot.blockedTopics,
    }
  );
  message = normalization.message;

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

  const promptVariant = [
    selectedScenario ? "topic-reservoir" : "standard-reply",
    feedbackSummary.hasSignal ? "feedback" : null,
    pivot.shouldPivot ? `pivot-${pivot.pivotStrength}` : null,
  ]
    .filter(Boolean)
    .join("+");

  const messageMetadata = buildMessageMetadata(
    normalization.usedFallback
      ? buildMessageTrace("reply", "fallback", {
          scenarioId: selectedScenario?.id ?? null,
          scenarioTitle: selectedScenario?.title ?? null,
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
      : selectedScenario
      ? buildMessageTrace("reply", "topic_reservoir", {
          scenarioId: selectedScenario.id,
          scenarioTitle: selectedScenario.title,
          promptVariant,
          pivotDetected: pivot.shouldPivot,
          blockedTopics: pivot.blockedTopics,
          feedbackSignal: {
            hasSignal: feedbackSummary.hasSignal,
            thumbsUpCount: feedbackSummary.thumbsUpCount,
            thumbsDownCount: feedbackSummary.thumbsDownCount,
          },
        })
      : buildMessageTrace("reply", "standard_reply", {
          promptVariant,
          pivotDetected: pivot.shouldPivot,
          blockedTopics: pivot.blockedTopics,
          feedbackSignal: {
            hasSignal: feedbackSummary.hasSignal,
            thumbsUpCount: feedbackSummary.thumbsUpCount,
            thumbsDownCount: feedbackSummary.thumbsDownCount,
          },
        })
  );

  return NextResponse.json({
    message,
    newConfidenceLevel,
    unlockedTier,
    messageMetadata,
  });
}
