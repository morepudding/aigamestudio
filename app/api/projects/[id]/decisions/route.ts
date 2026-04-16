import { NextRequest, NextResponse } from "next/server";
import {
  getDecisions,
  upsertDecisions,
  answerDecision,
  markDecisionsReady,
  areDecisionsReady,
  canMarkDecisionsReady,
} from "@/lib/services/decisionService";
import { getAllQuestions, getQuestionsForScope } from "@/lib/prompts/templates/decisions";
import type { DecisionScope } from "@/lib/types/decision";

/**
 * GET /api/projects/[id]/decisions
 * Returns all decisions for a project. If none exist yet, creates them from templates.
 * Query params: ?scope=global|gdd|tech-spec|... to filter
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scope = req.nextUrl.searchParams.get("scope") as DecisionScope | null;

  let decisions = await getDecisions(id);

  // Auto-seed questions from templates if none exist
  if (decisions.length === 0) {
    const allQuestions = getAllQuestions();
    decisions = await upsertDecisions(
      id,
      allQuestions.map((q) => ({
        scope: q.scope,
        questionKey: q.questionKey,
        questionText: q.questionText,
        options: q.options,
        sortOrder: q.sortOrder,
      }))
    );
  }

  if (scope) {
    decisions = decisions.filter((d) => d.scope === scope);
  }

  const ready = await areDecisionsReady(id);

  return NextResponse.json({ decisions, ready });
}

/**
 * POST /api/projects/[id]/decisions
 * Add custom AI-generated questions to the project.
 * Body: { questions: [{ scope, questionKey, questionText, options, sortOrder }] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (!body.questions || !Array.isArray(body.questions)) {
    return NextResponse.json({ error: "Missing questions array" }, { status: 400 });
  }

  const created = await upsertDecisions(id, body.questions);
  return NextResponse.json({ decisions: created });
}

/**
 * PATCH /api/projects/[id]/decisions
 * Answer a decision or mark all decisions as ready.
 * Body: { decisionId, selectedOption, freeText } or { markReady: true }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (body.markReady) {
    const validation = await canMarkDecisionsReady(id);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "Le cadrage avec Eve doit être complété avant de débloquer la rédaction.",
          total: validation.total,
          answered: validation.answered,
        },
        { status: 400 }
      );
    }

    await markDecisionsReady(id);
    return NextResponse.json({ ready: true });
  }

  if (!body.decisionId) {
    return NextResponse.json({ error: "Missing decisionId" }, { status: 400 });
  }

  const updated = await answerDecision(
    body.decisionId,
    body.selectedOption ?? null,
    body.freeText ?? null
  );

  if (!updated) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
