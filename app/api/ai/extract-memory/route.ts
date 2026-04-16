import { NextRequest, NextResponse } from "next/server";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Singleton types: only one entry per agent is kept (latest replaces previous)
const SINGLETON_TYPES = ["relationship", "nickname", "confidence"] as const;

interface ExtractedMemory {
  type: "summary" | "decision" | "preference" | "progress" | "relationship" | "nickname" | "confidence" | "boss_profile" | "family" | "hobbies" | "dreams" | "social" | "fears" | "personal_event" | "topic_tracker";
  content: string;
  importance: number; // 1-5, only >= 3 are saved
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { agentName, agentRole, conversationMessages, existingMemoriesByType } = body as {
    agentName: string;
    agentRole: string;
    conversationMessages: { sender: string; content: string }[];
    existingMemoriesByType?: Record<string, string>; // type → current content (for singletons) or concatenated entries
  };

  if (!agentName || !conversationMessages?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Only extract from the last N messages to keep costs down
  const recentMessages = conversationMessages.slice(-20);
  const transcript = recentMessages
    .map((m) => `${m.sender === "user" ? "Boss" : agentName}: ${m.content}`)
    .join("\n");

  // Build the existing memory context block
  const existingBlocks: string[] = [];
  if (existingMemoriesByType && Object.keys(existingMemoriesByType).length > 0) {
    for (const [type, content] of Object.entries(existingMemoriesByType)) {
      existingBlocks.push(`[${type}] ${content}`);
    }
  }
  const existingContext = existingBlocks.length > 0
    ? `\nMémoire existante :\n${existingBlocks.join("\n")}\n`
    : "";

  const singletonNote = SINGLETON_TYPES.map(t => {
    const current = existingMemoriesByType?.[t];
    return current
      ? `- "${t}" actuel : "${current}" → émets une entrée UNIQUEMENT si la situation a changé, avec le nouvel état complet`
      : `- "${t}" : pas encore de valeur → émets une entrée uniquement si la conversation contient une info concrète sur ce sujet`;
  }).join("\n");

  const systemPrompt = `Tu es un système d'analyse de conversation. Tu extrais les informations clés d'une conversation entre un boss et ${agentName} (${agentRole}).
${existingContext}
═══ CATÉGORIES ═══

TYPES NORMAUX (accumulation possible — n'extrait QUE ce qui est NOUVEAU par rapport à la mémoire existante) :
- "summary" : Sujet ou thème principal NOUVEAU discuté dans cette conversation
- "decision" : Décision concrète prise (pas une suggestion vague)
- "preference" : Préférence explicitement exprimée par le boss (pas une opinion floue)
- "progress" : Avancement concret d'un projet ou tâche (avec un état clair)
- "boss_profile" : CRUCIAL — Informations personnelles sur le boss lui-même : goûts, habitudes, vie perso, famille, état émotionnel révélé, anecdotes, passions, ce qu'il aime ou déteste.

VIE PERSONNELLE DE L'AGENT (co-construite en conversation — TRÈS IMPORTANT) :
- "family" : Famille de l'agent, origines, enfance, ville natale, parents, fratrie, souvenirs d'enfance. Ex: "${agentName} a un frère aîné musicien à Lyon"
- "hobbies" : Passions et activités HORS TRAVAIL de l'agent. Sport, musique, cuisine, lectures, séries, jeux, voyages. Ex: "${agentName} fait de l'escalade le weekend", "${agentName} écoute Radiohead en boucle"
- "dreams" : Rêves, aspirations et projets de vie de l'agent (pas que pro). Ex: "${agentName} rêve de visiter le Japon", "${agentName} veut écrire un roman un jour"
- "social" : Amis, cercle social, vie hors studio. Ex: "${agentName} a une meilleure amie nommée Léa depuis le lycée"
- "fears" : Peurs, vulnérabilités, insécurités de l'agent. Ex: "${agentName} a peur de parler en public", "${agentName} est mal à l'aise avec les conflits"
- "personal_event" : Événements récents dans la vie perso de l'agent (mentionnés ou inventés en conv). Ex: "${agentName} est allée voir un concert de jazz samedi", "${agentName} a mal dormi à cause de son chat"
- "topic_tracker" : Thème/sujet principal de cette conversation (1 par extraction). Pour que l'agent ne tourne pas en boucle sur les mêmes sujets. Ex: "blagues sur le café et les deadlines", "discussion sur le weekend", "partage sur la famille"

TYPES SINGLETON (1 seule entrée par agent — l'extraction émet l'ÉTAT MIS À JOUR complet, pas un delta) :
${singletonNote}

═══ SCORING D'IMPORTANCE (obligatoire) ═══
Chaque mémoire doit avoir un score "importance" de 1 à 5 :
- 5 : Information critique, irremplaçable (décision stratégique majeure, préférence forte explicite, surnom confirmé, détail de vie marquant)
- 4 : Informations utiles et durables (sujet principal, progression significative, moment de relation fort, passion ou rêve de l'agent)
- 3 : Informations utiles mais secondaires (détail de projet, ton général, moment de complicité, événement perso ponctuel)
- 2 : Trivial ou très situationnel → NE PAS inclure
- 1 : Sans valeur (formule de politesse, blague générique) → NE PAS inclure

RÈGLES ABSOLUES :
- N'inclus JAMAIS de mémoires avec importance < 3
- N'inclus JAMAIS une info déjà présente dans la mémoire existante (types normaux)
- Les types singleton : émet uniquement si l'état a changé OU si c'est la première fois
- Privilégie les détails de VIE PERSONNELLE de l'agent quand la conversation en contient — c'est ce qui construit son identité
- Émets TOUJOURS un "topic_tracker" résumant le thème principal de la conversation
- Si rien de notable, réponds []

Réponds UNIQUEMENT avec un tableau JSON valide. Chaque entrée : "type", "content" (1 phrase max), "importance" (3-5).

Exemple :
[
  {"type": "preference", "content": "Le boss veut du pixel art 32x32 inspiré de Celeste", "importance": 5},
  {"type": "boss_profile", "content": "Le boss écoute du jazz en travaillant et aime les matins calmes", "importance": 4},
  {"type": "family", "content": "${agentName} a une petite sœur de 12 ans qui veut devenir vétérinaire", "importance": 4},
  {"type": "hobbies", "content": "${agentName} fait de la poterie le dimanche matin", "importance": 4},
  {"type": "dreams", "content": "${agentName} rêve d'ouvrir un café-librairie un jour", "importance": 4},
  {"type": "social", "content": "${agentName} a un groupe d'amis du lycée avec qui elle fait des escape games", "importance": 3},
  {"type": "fears", "content": "${agentName} a le vertige et refuse de monter dans les grandes roues", "importance": 3},
  {"type": "personal_event", "content": "${agentName} a essayé un nouveau resto thaï ce weekend et a adoré", "importance": 3},
  {"type": "topic_tracker", "content": "Discussion sur les hobbies du weekend et la famille", "importance": 3},
  {"type": "relationship", "content": "Relation détendue et complice, le boss tutoie l'agent et plaisante librement", "importance": 3}
]`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.tasks,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Voici la conversation :\n\n${transcript}` },
      ],
      max_tokens: 600,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText }, { status: res.status });
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "[]";

  // Extract JSON array from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ memories: [] });
  }

  try {
    const parsed: ExtractedMemory[] = JSON.parse(jsonMatch[0]);
    const validTypes = ["summary", "decision", "preference", "progress", "relationship", "nickname", "confidence", "boss_profile", "family", "hobbies", "dreams", "social", "fears", "personal_event", "topic_tracker"];
    const validated = parsed.filter(
      (m) =>
        validTypes.includes(m.type) &&
        typeof m.content === "string" &&
        m.content.trim() &&
        typeof m.importance === "number" &&
        m.importance >= 3 // discard trivial memories before even saving
    );
    // Normalise importance to 3-5 range
    const normalised = validated.map((m) => ({
      ...m,
      importance: Math.max(3, Math.min(5, Math.round(m.importance))),
    }));
    return NextResponse.json({ memories: normalised });
  } catch {
    return NextResponse.json({ memories: [] });
  }
}
