import { NextRequest, NextResponse } from "next/server";
import { getAgentBySlug } from "@/lib/services/agentService";
import { LLM_MODELS } from "@/lib/config/llm";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK_MESSAGE = (agentName: string) =>
  `Hey boss ! On a du sang neuf aujourd'hui — ${agentName} vient d'arriver. J'ai préparé un petit apéro de bienvenue pour faire connaissance. Tu me connais, je fais jamais les choses à moitié 😏 Allez, viens, on va voir ce que ${agentName} a dans le ventre.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await req.json();
  const { slug } = body;

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  const agent = await getAgentBySlug(safeSlug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const genderAdj = agent.gender === "femme" ? "e" : "";

  const prompt = `Tu es Eve, la Producer d'Eden Studio. Tu es cool, directe, chaleureuse, un peu dragueuse mais toujours pro.

Le boss (le joueur) vient de recruter un nouveau membre pour l'équipe :
- Nom : ${agent.name}
- Rôle : ${agent.role}
- Département : ${agent.department}
- Personnalité : ${agent.personality_primary}, ${agent.personality_nuance}
- Genre : ${agent.gender}

Tu organises un petit moment afterwork informel pour que le boss fasse connaissance avec ${agent.name}. C'est TOI qui présentes la soirée — ambiance détente, apéro, pas un entretien formel.

Écris un message court (3-4 phrases) où tu :
1. Accueilles le boss avec ton énergie habituelle
2. Annonces que ${agent.name} vient d'arriver et qu'il est temps de faire connaissance
3. Donnes le ton : c'est détendu, c'est fun, on va découvrir qui est vraiment ${agent.name}

Ton : familier, tutoiement, 1-2 émojis max. Sois toi-même — chaleureuse et directe.
Le/la nouvea${genderAdj === "e" ? "lle" : "u"} est là, on va s'amuser.`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODELS.chat,
        messages: [
          {
            role: "system",
            content: "Tu es Eve, Producer d'Eden Studio. Tu parles UNIQUEMENT en français. Tu es directe, chaleureuse, cool et un peu dragueuse. Tu tutoies tout le monde. Réponse brève et immersive.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 250,
        temperature: 0.65,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ message: FALLBACK_MESSAGE(agent.name) });
    }

    const data = await res.json();
    let message: string = data.choices?.[0]?.message?.content ?? "";

    // Filter non-Latin characters
    message = message
      .replace(
        /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2600-\u27BF\uFE00-\uFE0F\u{1F300}-\u{1FAFF}]/gu,
        ""
      )
      .trim();

    if (!message) {
      return NextResponse.json({ message: FALLBACK_MESSAGE(agent.name) });
    }

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ message: FALLBACK_MESSAGE(agent.name) });
  }
}
