import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import { getProjectById } from "@/lib/services/projectService";
import { getAnsweredDecisions } from "@/lib/services/decisionService";
import type { DecisionScope } from "@/lib/types/decision";

/**
 * POST /api/ai/generate-questions
 * Eve (Producer) generates contextual follow-up questions based on the project
 * and already-answered decisions.
 *
 * Body: { projectId, scope: "gdd" | "tech-spec" | ... }
 * Returns: { questions: [{ questionKey, questionText, options, scope, sortOrder }] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, scope } = body as { projectId: string; scope: DecisionScope };

  if (!projectId || !scope) {
    return NextResponse.json({ error: "Missing projectId or scope" }, { status: 400 });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get already answered decisions for context
  const answered = await getAnsweredDecisions(projectId);
  const answeredContext = answered
    .map((d) => {
      const answer = d.freeText
        ? `${d.selectedOption ?? ""} — ${d.freeText}`.trim()
        : d.selectedOption ?? "";
      return `- ${d.questionText} → ${answer}`;
    })
    .join("\n");

  const prompt = `Tu es Eve, la Productrice d'Eden Studio, un studio de jeux vidéo indépendant.

Le directeur prépare le projet "${project.title}" : ${project.description}
Genre : ${project.genre} | Moteur : ${project.engine} | Plateformes : ${project.platforms.join(", ")}

${answeredContext ? `Décisions déjà prises par le directeur :\n${answeredContext}\n` : ""}

Tu dois générer 2-3 questions supplémentaires à choix multiples spécifiques au document "${scope}" pour affiner la rédaction.
Ces questions doivent :
- Compléter les décisions déjà prises (ne pas répéter)
- Être spécifiques au genre "${project.genre}" et au type de document "${scope}"
- Proposer 3-5 options pertinentes par question
- Aider à éviter que l'IA prenne des décisions arbitraires

Réponds UNIQUEMENT en JSON valide, sans backticks ni texte :
{
  "questions": [
    {
      "questionKey": "identifiant_unique_snake_case",
      "questionText": "La question ?",
      "options": ["Option 1", "Option 2", "Option 3"]
    }
  ]
}`;

  try {
    const { content } = await callOpenRouter(
      LLM_MODELS.chat,
      [
        {
          role: "system",
          content:
            "Tu es Eve, productrice de jeux vidéo. Tu poses des questions stratégiques au directeur pour guider la rédaction des documents. Réponds uniquement en JSON valide.",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.7, max_tokens: 800 }
    );

    // Parse JSON from response
    const cleaned = content
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ questions: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const questions = (parsed.questions ?? []).map(
      (q: { questionKey: string; questionText: string; options: string[] }, i: number) => ({
        questionKey: `ai_${scope}_${q.questionKey}`,
        questionText: q.questionText,
        options: q.options,
        scope,
        sortOrder: 100 + i,
      })
    );

    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ questions: [] });
  }
}
