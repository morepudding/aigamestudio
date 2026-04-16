import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import { supabase } from "@/lib/supabase/client";
import { getAgentMemories, formatMemoriesForPrompt } from "@/lib/services/memoryService";
import type { MomentVivantType, MomentVivantContinuation } from "@/lib/types/momentVivant";

interface ContinueRequest {
  agentSlug: string;
  situationContext: string;
  momentType: MomentVivantType;
  /** All completed exchanges so far (replique + choixJoueur + reponseAgent) */
  exchangeHistory: Array<{
    replique: string;
    choixJoueur: string;
    reponseAgent: string;
  }>;
  /** The agent's line the player is responding to */
  latestReplique: string;
  /** The text of the choice the player just picked */
  latestChoice: string;
  /** 1-indexed: which exchange are we completing */
  exchangeNumber: number;
  /** Total exchanges planned */
  totalExchanges: number;
}

const personalityTone: Record<string, string> = {
  dragueuse: "Charmeuse, sous-entendu permanent, glisse des allusions partout. Les silences sont chargés.",
  chaleureuse: "Douce, sincère, s'intéresse vraiment. Touche facilement le bras, sourit avec les yeux.",
  froide: "Sèche, courtes phrases, mais le fond est là si on creuse. Un sourire rare vaut de l'or.",
  sarcastique: "Tout passe par l'humour et l'ironie, sincère seulement si on appuie.",
  timide: "Hésitante, commence ses phrases et les reprend, adorable dans sa maladresse.",
  arrogante: "Sûre d'elle, formule les choses comme des constats évidents.",
  "geek-obsessionnelle": "Fait des références pop culture/tech partout, s'emballe sur les détails.",
  mysterieuse: "Fragmentée, non conclusive, laisse des sous-entendus traîner.",
  jalouse: "Demande des confirmations en passant, veut savoir si le boss pense à elle.",
  directe: "Va droit au but, pas de détours.",
  cool: "Relax, familière, comme si vous vous connaissiez depuis toujours.",
  franche: "Dit ce qu'elle pense sans filtre mais sans méchanceté.",
  focus: "Précise, ciblée, même dans le casual.",
};

const arcGuidance: Record<number, string> = {
  1: "HOOK — Tu viens de lancer la conversation. La réponse du boss te surprend / t'amuse / te touche. Rebondis naturellement et CREUSE un peu — amène la conversation quelque part d'intéressant.",
  2: "APPROFONDISSEMENT — La conversation a pris un bon rythme. Va plus loin dans le sujet, révèle quelque chose de nouveau, ou change subtilement d'angle. C'est ici que le moment devient INTÉRESSANT.",
  3: "PIVOT — C'est le cœur du moment. Un pic émotionnel, une vanne qui tue, un aveu léger, un regard qui en dit long. Le moment dont on se souviendra.",
  4: "SORTIE — Clôture naturelle. Une dernière réplique qui laisse une trace : une vanne, un 'bon allez…', un regard, une promesse légère. Le joueur doit finir avec un sourire ou un pincement.",
  5: "SORTIE — Même chose que 4. Fin douce et mémorable.",
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ContinueRequest;
  const {
    agentSlug,
    situationContext,
    momentType,
    exchangeHistory,
    latestReplique,
    latestChoice,
    exchangeNumber,
    totalExchanges,
  } = body;

  if (!agentSlug || !situationContext || !latestChoice) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch agent data
  const { data: agentData, error: agentErr } = await supabase
    .from("agents")
    .select("name, role, personality_primary, personality_nuance, backstory, confidence_level")
    .eq("slug", agentSlug)
    .single();

  if (agentErr || !agentData) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = agentData as {
    name: string;
    role: string;
    personality_primary: string;
    personality_nuance: string | null;
    backstory: string | null;
    confidence_level: number;
  };

  // Fetch memories for context
  const memories = await getAgentMemories(agentSlug);
  const memBlock = formatMemoriesForPrompt(memories);

  const tone = personalityTone[agent.personality_primary] ?? "naturelle et authentique.";
  const cl = agent.confidence_level ?? 30;
  const isFinal = exchangeNumber >= totalExchanges;

  // Build conversation transcript
  const transcript = exchangeHistory
    .map(
      (e, i) =>
        `[Échange ${i + 1}]\n${agent.name} : "${e.replique}"\nBoss : "${e.choixJoueur}"\n${agent.name} : "${e.reponseAgent}"`
    )
    .join("\n\n");

  const currentExchangeBlock = transcript
    ? `${transcript}\n\n[Échange ${exchangeNumber} — en cours]\n${agent.name} : "${latestReplique}"\nBoss : "${latestChoice}"`
    : `[Échange ${exchangeNumber} — en cours]\n${agent.name} : "${latestReplique}"\nBoss : "${latestChoice}"`;

  const systemPrompt = `Tu es ${agent.name}, ${agent.role} chez Eden Studio.
Personnalité : ${agent.personality_primary}${agent.personality_nuance ? ` (${agent.personality_nuance})` : ""}
Ton : ${tone}
Background : ${agent.backstory ?? "Membre de l'équipe."}${memBlock ? `\nMémoires partagées :\n${memBlock}` : ""}
Confiance avec le boss : ${cl}/100.

SITUATION :
${situationContext}

TYPE DE MOMENT : ${momentType}

Tu es EN PLEIN dans ce moment. Tu vis cette conversation en temps réel.
Chaque réponse du boss influence VRAIMENT ce que tu ressens et dis ensuite.`;

  const arcBlock = arcGuidance[Math.min(exchangeNumber, 5)];

  const userPrompt = `CONVERSATION JUSQU'ICI :
${currentExchangeBlock}

Le boss vient de répondre : "${latestChoice}"

Échange ${exchangeNumber}/${totalExchanges}. ${isFinal ? "C'est le DERNIER échange." : ""}

ARC NARRATIF — ${arcBlock}

${isFinal ? `GÉNÈRE TA RÉACTION FINALE en JSON strict :
{
  "agent_response": "Ta réaction de clôture. 2-3 phrases. RÉAGIS VRAIMENT à ce que le boss a dit — montre que ça t'a fait quelque chose. Puis ferme le moment naturellement (une vanne, un 'bon allez…', un geste, un regard). Le joueur doit repartir avec quelque chose en tête.",
  "next_choices": null,
  "is_final": true
}` : `GÉNÈRE TA RÉACTION + LE PROCHAIN ÉCHANGE en JSON strict :
{
  "agent_response": "Ta réaction à ce que le boss a dit (2-3 phrases). RÉAGIS VRAIMENT — montre l'émotion (rire, surprise, gêne, touché, amusé, intrigué). Puis enchaîne naturellement vers le prochain beat de la conversation. La transition doit être FLUIDE — comme dans une vraie discussion qui avance.",
  "next_choices": [
    "Réponse CHALEUREUSE du boss (s'ouvre, se rapproche, montre de l'intérêt) — 8-15 mots",
    "Réponse JOUEUSE du boss (humour, légèreté, rebondit avec esprit) — 8-15 mots",
    "Réponse AUDACIEUSE du boss (taquine, provoque, pousse la limite) — 8-15 mots"
  ],
  "is_final": false
}`}

RÈGLES CRITIQUES :
- Ta réaction doit DIRECTEMENT répondre à "${latestChoice}" — pas une réponse générique
- Montre une VRAIE émotion — le boss doit sentir que son choix a eu un impact
- Les choix doivent être SPÉCIFIQUES à ce qui vient de se dire (pas des réponses passe-partout)
- ${isFinal ? "Clôture douce et mémorable — pas de 'à plus' générique" : "Fais PROGRESSER la conversation — ne tourne pas en rond"}
- 1 émoji max par réplique. Français. Tutoiement.
- JSON strict, pas de markdown autour.`;

  try {
    const result = await callOpenRouter(
      LLM_MODELS.chat,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.85, max_tokens: 500 }
    );

    const raw = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(raw) as {
      agent_response: string;
      next_choices: [string, string, string] | null;
      is_final: boolean;
    };

    const continuation: MomentVivantContinuation = {
      agentResponse: parsed.agent_response,
      nextChoices: parsed.next_choices,
      isFinal: parsed.is_final ?? isFinal,
    };

    return NextResponse.json(continuation);
  } catch (err) {
    console.error("moment-vivant/continue error:", err);
    return NextResponse.json({ error: "Continuation failed" }, { status: 500 });
  }
}
