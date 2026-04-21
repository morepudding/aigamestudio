import { NextRequest, NextResponse } from "next/server";
import { validateGameSpec, generateValidationReport } from "@/lib/services/specValidationService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentType, content, title } = body;

    if (!documentType || !content || !title) {
      return NextResponse.json(
        { error: "Missing required fields: documentType, content, title" },
        { status: 400 }
      );
    }

    if (documentType !== 'one-page' && documentType !== 'gdd') {
      return NextResponse.json(
        { error: "documentType must be 'one-page' or 'gdd'" },
        { status: 400 }
      );
    }

    // Valider le document
    const validationResult = await validateGameSpec(documentType, content, title);
    const report = generateValidationReport(validationResult, title);

    return NextResponse.json({
      valid: validationResult.valid,
      score: validationResult.score,
      report,
      metrics: validationResult.metrics,
      issues: validationResult.issues,
      suggestions: validationResult.suggestions
    });

  } catch (error) {
    console.error("[spec/validate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}