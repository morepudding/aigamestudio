/**
 * POST /api/eve/synthesize
 *
 * Takes the original feature prompt + answered questions,
 * computes total score, then either:
 *   - score >= threshold → generates a short alignment text (max 30 lines)
 *   - score < threshold  → proposes additions to enrich the spec
 *
 * Body: { prompt: string; questions: EveQuestion[]; answers: Record<questionId, answerId[]> }
 * Returns: { score: number; maxScore: number; needsEnrichment: boolean; synthesis: string; suggestions?: string[] }
 */

import { NextRequest as NR, NextResponse as NResp } from "next/server";
import type { EveQuestion } from "../analyze/route";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";

const SCORE_THRESHOLD_RATIO = 0.55; // 55% of max score required to proceed

const EVE_SYSTEM = `Tu es Eve, Producer chez Eden Studio. Tu formules une synthèse claire et courte de la feature à implémenter.
Tu écris en français. Ton style : direct, professionnel, sans fioritures. Pas de markdown, juste du texte.`;

export async function POST(req: NR) {
  try {
    const body = await req.json() as {
      prompt: string;
      questions: EveQuestion[];
      answers: Record<string, string[]>;
    };

    const { prompt, questions, answers } = body;

    if (!prompt || !questions?.length || !answers) {
      return NResp.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Compute score
    let totalScore = 0;
    let maxScore = 0;

    const answeredSummary: string[] = [];

    for (const q of questions) {
      const selectedIds = answers[q.id] ?? [];
      const selectedAnswers = q.answers.filter((a) => selectedIds.includes(a.id));
      const qMax = Math.max(...q.answers.map((a) => a.score));
      const qScore = selectedAnswers.reduce((sum, a) => sum + a.score, 0);

      maxScore += qMax;
      totalScore += Math.min(qScore, qMax); // cap at max for multi-select

      if (selectedAnswers.length > 0) {
        answeredSummary.push(
          `Q: ${q.question}\nR: ${selectedAnswers.map((a) => a.label).join(", ")}`
        );
      }
    }

    const scoreRatio = maxScore > 0 ? totalScore / maxScore : 0;
    const needsEnrichment = scoreRatio < SCORE_THRESHOLD_RATIO;

    if (needsEnrichment) {
      // Ask Eve to suggest additions
      const enrichPrompt = `Demande de feature :
"""
${prompt}
"""

Réponses aux questions de précision :
${answeredSummary.join("\n\n")}

Score de clarté : ${Math.round(scoreRatio * 100)}% (seuil minimum : ${Math.round(SCORE_THRESHOLD_RATIO * 100)}%)

La spec est trop vague. Propose 2 à 4 suggestions concrètes pour l'enrichir.
Réponds UNIQUEMENT avec ce JSON (pas de markdown) :
{
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;

      const resp = await callOpenRouter(
        LLM_MODELS.tasks,
        [
          { role: "system", content: EVE_SYSTEM },
          { role: "user", content: enrichPrompt },
        ],
        { temperature: 0.4, max_tokens: 512 }
      );

      const cleaned = resp.content.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as { suggestions: string[] };

      return NResp.json({
        score: totalScore,
        maxScore,
        needsEnrichment: true,
        synthesis: "",
        suggestions: parsed.suggestions,
      });
    }

    // Good score — generate synthesis text
    const synthesisPrompt = `Demande de feature :
"""
${prompt}
"""

Précisions apportées :
${answeredSummary.join("\n\n")}

Rédige un texte de synthèse de 10 à 30 lignes maximum qui résume la feature à implémenter.
Ce texte sera soumis à validation avant implémentation. Sois précis sur :
- Ce que ça fait (comportement utilisateur)
- Comment ça s'intègre dans l'existant
- Ce qui sera créé / modifié (fichiers / composants)
N'inclus pas de code, juste la description.`;

    const synthResp = await callOpenRouter(
      LLM_MODELS.tasks,
      [
        { role: "system", content: EVE_SYSTEM },
        { role: "user", content: synthesisPrompt },
      ],
      { temperature: 0.3, max_tokens: LLM_PARAMS.tasks.max_tokens }
    );

    return NResp.json({
      score: totalScore,
      maxScore,
      needsEnrichment: false,
      synthesis: synthResp.content.trim(),
      suggestions: undefined,
    });
  } catch (err) {
    console.error("[eve/synthesize]", err);
    return NResp.json({ error: "Failed to synthesize" }, { status: 500 });
  }
}
