/**
 * POST /api/eve/analyze
 *
 * Receives a raw feature request from the user.
 * Eve reads the codebase context, then generates 3-5 clarifying questions
 * with multiple-choice answers and a score weight per answer.
 *
 * Body: { prompt: string; relevantPaths?: string[] }
 * Returns: { questions: EveQuestion[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { buildEdenCodebaseContext } from "@/lib/services/githubService";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";

export interface EveAnswer {
  id: string;       // unique within question, e.g. "a" | "b" | "c"
  label: string;    // short display text
  score: number;    // 0–10, higher = better aligned with a solid spec
}

export interface EveQuestion {
  id: string;
  question: string;
  multiSelect: boolean;
  answers: EveAnswer[];
}

export interface AnalyzeResponse {
  questions: EveQuestion[];
}

const EVE_SYSTEM = `Tu es Eve, Producer chez Eden Studio. Tu es le bras droit du fondateur.
Tu es directe, chaleureuse, et tu parles comme quelqu'un qui connaît parfaitement la codebase.
Ton rôle ici : analyser une demande de feature et poser les bonnes questions pour la préciser.
Tu réponds UNIQUEMENT en JSON valide, pas de markdown autour.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt: string; relevantPaths?: string[] };
    const { prompt, relevantPaths } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    // Fetch codebase context from GitHub
    const codebaseContext = await buildEdenCodebaseContext(relevantPaths);

    const userMessage = `
${codebaseContext}

---

Demande de feature de l'utilisateur :
"""
${prompt}
"""

Génère entre 3 et 5 questions pour préciser cette feature. Chaque question doit :
- Être fermée (choix multiples)
- Avoir 2 à 4 réponses possibles
- Chaque réponse a un score de 0 à 10 (10 = spec très claire/complète, 0 = spec vague/incomplète)
- multiSelect = true si plusieurs réponses peuvent être combinées, false sinon

Réponds UNIQUEMENT avec ce JSON (pas de markdown) :
{
  "questions": [
    {
      "id": "q1",
      "question": "texte de la question",
      "multiSelect": false,
      "answers": [
        { "id": "a", "label": "texte réponse", "score": 8 },
        { "id": "b", "label": "texte réponse", "score": 4 }
      ]
    }
  ]
}`;

    const response = await callOpenRouter(
      LLM_MODELS.tasks,
      [
        { role: "system", content: EVE_SYSTEM },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3, max_tokens: LLM_PARAMS.tasks.max_tokens }
    );

    // Parse JSON — strip any accidental markdown fences
    const cleaned = response.content
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as AnalyzeResponse;

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[eve/analyze]", err);
    return NextResponse.json(
      { error: "Failed to analyze feature request" },
      { status: 500 }
    );
  }
}
