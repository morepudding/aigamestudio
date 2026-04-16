import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/config/llm";
import { LLM_MODELS } from "@/lib/config/llm";
import type { MomentVivantType, MomentVivantSeed } from "@/lib/types/momentVivant";

interface GenerateRequest {
  agentSlug: string;
  agentName: string;
  role: string;
  personalityPrimary: string;
  personalityNuance?: string;
  backstory?: string;
  memories?: string;
  confidenceLevel?: number;
  momentType: MomentVivantType;
}

const momentTypeInstructions: Record<MomentVivantType, string> = {
  "pause-café": `PAUSE-CAFÉ — Un moment léger, hors boulot, drôle ou anodin.
Le genre de truc qu'on fait quand on croit que personne regarde : un hobby au bureau, une question existentielle débile, un truc bizarre avec sa nourriture.`,

  "drague": `DRAGUE — Un moment avec du sous-texte, un compliment détourné, une proximité.
Le ton est léger et joueur — du jeu, pas de la pression.`,

  "complicité": `COMPLICITÉ — Un moment de connexion basé sur du vécu partagé.
Un point commun découvert, un souvenir en commun, une private joke. Utilise les mémoires si disponibles.`,

  "petite-friction": `PETITE-FRICTION — Une taquinerie, un agacement léger, du caractère.
Un désaccord de goût, une moquerie gentille, un reproche déguisé en question. Pas de drama.`,

  "confidence": `CONFIDENCE — L'agent lâche un truc perso, spontanément.
Pris en flag d'un truc embarrassant, un moment de fatigue, un aveu inattendu. Spontané, pas dramatique.`,
};

const personalityTone: Record<string, string> = {
  dragueuse: "Charmeuse, allusions légères.",
  chaleureuse: "Sincère, attentionnée.",
  froide: "Concise, rare mais intense.",
  sarcastique: "Ironie affectueuse, humour.",
  timide: "Hésitante, maladroite, touchante.",
  arrogante: "Assurée, directe, impressionnée quand ça arrive.",
  "geek-obsessionnelle": "Passionnée, références pop culture.",
  mysterieuse: "Fragmentée, énigmatique.",
  jalouse: "Veut savoir, possessive mais touchante.",
  directe: "Franche, pas de détours.",
  cool: "Relax, familière.",
  franche: "Sans filtre, sans méchanceté.",
  focus: "Précise, même dans le casual.",
};

// ────────────────────────────────────────
// PHASE 1 : Situation Architect
// ────────────────────────────────────────
async function generateSituation(body: GenerateRequest): Promise<{
  situationContext: string;
  messageOuverture: string;
  totalExchanges: number;
}> {
  const {
    agentName,
    role,
    personalityPrimary,
    personalityNuance,
    backstory,
    memories,
    confidenceLevel,
    momentType,
  } = body;

  const tone = personalityTone[personalityPrimary] ?? "naturelle et authentique.";
  const cl = confidenceLevel ?? 30;
  const memBlock = memories
    ? `\nCe que ${agentName} sait du boss (mémoires partagées) :\n${memories}`
    : "\nPas encore de mémoires partagées — c'est une relation qui se construit.";

  const systemPrompt = `Tu crées des micro-situations de tranche de vie entre un collègue et son boss dans un studio.

Chaque situation doit être :
- Spécifique : lieu, moment, détail concret
- Humaine : quelque chose de banal mais touchant, drôle ou taquin
- Engageante : le joueur doit avoir envie de répondre

Ce ne sont PAS des scènes de cinéma. Ce sont des moments réels de bureau.`;

  const typeBlock = momentTypeInstructions[momentType];

  const userPrompt = `Crée une situation de type "${momentType}" pour ${agentName}.

PROFIL DE L'AGENT :
- Rôle : ${role}
- Personnalité : ${personalityPrimary}${personalityNuance ? ` (nuance : ${personalityNuance})` : ""}
- Ton : ${tone}
- Background : ${backstory ?? "Membre de l'équipe."}
- Confiance avec le boss : ${cl}/100
${memBlock}

TYPE DE MOMENT :
${typeBlock}

GÉNÈRE EN JSON STRICT :
{
  "situation_context": "Description riche et visuelle de la scène en 4-6 phrases. DÉTAILLE : OÙ (lieu précis du studio), QUAND (moment de la journée, contexte), CE QUE L'AGENT FAIT (action physique concrète), LE DÉTAIL QUI REND LA SCÈNE VIVANTE (un objet, une lumière, un son, un geste), L'ÉMOTION SOUS-JACENTE (ce que l'agent ressent vraiment). Cette description est une bible narrative — elle ne sera JAMAIS montrée au joueur mais guidera chaque échange.",
  "message_ouverture": "Message court (1-2 phrases MAX) envoyé dans le chat normal comme HOOK. Doit donner envie de cliquer. Mystérieux, drôle, intrigant, ou touchant. Dans le style de l'agent. Exemples de bon hooks : 'J'ai une question qui va déterminer si on peut continuer à travailler ensemble.', 'Ok je vais avoir besoin d'un avis 100% honnête là.'",
  "total_exchanges": 4
}

RÈGLES :
- total_exchanges entre 4 et 5 selon la richesse naturelle de la situation
- Le message_ouverture NE DOIT PAS spoiler la situation — il TEASE
- La situation doit contenir assez de matière pour ${cl >= 40 ? "4-5" : "4"} échanges qui PROGRESSENT
- Français uniquement. Tutoiement si confiance >= 20.
- JSON strict, pas de markdown autour.`;

  const result = await callOpenRouter(
    LLM_MODELS.chat,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.9, max_tokens: 800 }
  );

  const raw = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(raw) as {
    situation_context: string;
    message_ouverture: string;
    total_exchanges: number;
  };

  return {
    situationContext: parsed.situation_context,
    messageOuverture: parsed.message_ouverture,
    totalExchanges: Math.min(Math.max(parsed.total_exchanges ?? 4, 3), 5),
  };
}

// ────────────────────────────────────────
// PHASE 2 : First Exchange
// ────────────────────────────────────────
async function generateFirstExchange(
  body: GenerateRequest,
  situationContext: string
): Promise<{
  firstReplique: string;
  firstChoices: [string, string, string];
}> {
  const {
    agentName,
    role,
    personalityPrimary,
    personalityNuance,
    backstory,
    memories,
    confidenceLevel,
  } = body;

  const tone = personalityTone[personalityPrimary] ?? "naturelle et authentique.";
  const cl = confidenceLevel ?? 30;
  const memBlock = memories ? `\nMémoires partagées avec le boss :\n${memories}` : "";

  const systemPrompt = `Tu es ${agentName}, ${role} chez Eden Studio.
Personnalité : ${personalityPrimary}${personalityNuance ? ` (${personalityNuance})` : ""}
Background : ${backstory ?? "Membre de l'équipe."}${memBlock}
Confiance avec le boss : ${cl}/100.

SITUATION EN COURS :
${situationContext}

Tu vis ce moment. Parle naturellement, comme dans la vraie vie.`;

  const userPrompt = `Génère le premier échange de ce moment.

FORMAT JSON STRICT :
{
  "replique": "Ta première ligne. 1-3 phrases max, naturelle.",
  "choix": [
    "Réponse chaleureuse du boss — 8-15 mots",
    "Réponse joueuse du boss — 8-15 mots",
    "Réponse audacieuse du boss — 8-15 mots"
  ]
}

RÈGLES POUR LES CHOIX :
- 3 postures relationnelles différentes, toutes tentantes
- Pas de bonne/mauvaise réponse — des couleurs différentes
- Spécifiques à cette situation, pas génériques
- Français, tutoiement, naturel
- JSON strict, pas de markdown autour.`;

  const result = await callOpenRouter(
    LLM_MODELS.chat,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.9, max_tokens: 400 }
  );

  const raw = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(raw) as {
    replique: string;
    choix: [string, string, string];
  };

  return {
    firstReplique: parsed.replique,
    firstChoices: parsed.choix,
  };
}

// ────────────────────────────────────────
// ENDPOINT
// ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateRequest;

  if (!body.agentName || !body.momentType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Phase 1 : Créer la situation
    const { situationContext, messageOuverture, totalExchanges } =
      await generateSituation(body);

    // Phase 2 : Générer le premier échange
    const { firstReplique, firstChoices } =
      await generateFirstExchange(body, situationContext);

    const scene: MomentVivantSeed = {
      situationContext,
      totalExchanges,
      firstReplique,
      firstChoices,
    };

    return NextResponse.json({
      messageOuverture,
      scene,
    });
  } catch (err) {
    console.error("moment-vivant/generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
