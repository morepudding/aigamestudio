import { NextRequest, NextResponse } from "next/server";
import { getProjectById, updateProject } from "@/lib/services/projectService";
import { getTasksByProject } from "@/lib/services/pipelineService";
import {
  enableGithubPages,
  ensureRepoIsPublic,
  resolvePagesPreviewUrl,
  waitForPagesDeployment,
} from "@/lib/services/githubService";
import { captureScreenshot, waveScreenshotPath } from "@/lib/services/screenshotService";
import {
  generateWaveReport,
  upsertWaveReview,
  approveWaveReview,
  rejectWaveReview,
  getWaveReview,
} from "@/lib/services/waveReviewService";

// ============================================================
// POST /api/pipeline/[projectId]/wave-review
// Déclenche le checkpoint visuel pour une wave terminée :
//   1. Active GitHub Pages si nécessaire
//   2. Attend le déploiement
//   3. Screenshot via Playwright
//   4. Génère le rapport LLM
//   5. Persiste la WaveReview en DB
//
// Body: { waveNumber: number }
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.githubRepoName) {
    return NextResponse.json({ error: "Le projet n'a pas de repo GitHub." }, { status: 409 });
  }

  let body: { waveNumber?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { waveNumber } = body;
  if (typeof waveNumber !== "number" || waveNumber < 1) {
    return NextResponse.json({ error: "waveNumber must be a positive integer" }, { status: 400 });
  }

  // Vérifier que toutes les tâches de cette wave sont terminées
  const allTasks = await getTasksByProject(projectId, "in-dev");
  const waveTasks = allTasks.filter((t) => t.waveNumber === waveNumber);
  const incomplete = waveTasks.filter((t) => t.status !== "completed");
  if (incomplete.length > 0) {
    return NextResponse.json(
      {
        error: `${incomplete.length} tâche(s) non terminée(s) dans la wave ${waveNumber}.`,
        incompleteTasks: incomplete.map((t) => ({ id: t.id, title: t.title, status: t.status })),
      },
      { status: 409 }
    );
  }

  try {
    // 1. Rendre le repo public puis activer GitHub Pages
    await ensureRepoIsPublic(project.githubRepoName);
    const pagesUrl = await enableGithubPages(project.githubRepoName);

    // Sauvegarder l'URL de déploiement sur le projet
    if (!project.deploymentUrl) {
      await updateProject(projectId, { deploymentUrl: pagesUrl });
    }

    // 2. Créer la review en "pending" avec l'URL Pages dès maintenant
    await upsertWaveReview(projectId, waveNumber, { pagesUrl, status: "pending" });

    // 3. Attendre le déploiement (max 3 min)
    const { ready } = await waitForPagesDeployment(pagesUrl);
    if (!ready) {
      // Pages pas encore prêt — on retourne quand même la review sans screenshot
      const review = await getWaveReview(projectId, waveNumber);
      return NextResponse.json(
        {
          review,
          warning: "GitHub Pages n'est pas encore prêt. Relance le checkpoint dans quelques minutes.",
        },
        { status: 202 }
      );
    }

    const preview = await resolvePagesPreviewUrl(pagesUrl);
    const hasPlayablePreview = preview.kind === "playable";
    const previewUrl = hasPlayablePreview ? preview.url : null;

    let screenshotUrl: string | null = null;
    let screenshotTakenAt: string | null = null;

    if (previewUrl) {
      const storagePath = waveScreenshotPath(projectId, waveNumber);
      screenshotUrl = await captureScreenshot(previewUrl, storagePath);
      screenshotTakenAt = new Date().toISOString();
    }

    // 5. Rapport LLM
    const reportMarkdown = await generateWaveReport(project, waveNumber, waveTasks, previewUrl);

    // 6. Persister
    const review = await upsertWaveReview(projectId, waveNumber, {
      pagesUrl: previewUrl,
      screenshotUrl,
      screenshotTakenAt,
      reportMarkdown,
      reportGeneratedAt: new Date().toISOString(),
      status: "pending",
    });

    const warning = hasPlayablePreview
      ? null
      : "Aucun build jouable n'est encore publié pour cette wave. Le checkpoint a généré un rapport sans screenshot.";

    return NextResponse.json(
      warning ? { review, warning } : { review },
      { status: warning ? 202 : 201 }
    );
  } catch (err) {
    console.error("[wave-review/POST] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create wave review" },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/pipeline/[projectId]/wave-review
// Décision de l'utilisateur sur la review d'une wave.
//
// Body: { waveNumber: number, action: "approve" | "reject", rejectionPrompt?: string }
// ============================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: { waveNumber?: number; action?: string; rejectionPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { waveNumber, action, rejectionPrompt } = body;

  if (typeof waveNumber !== "number" || waveNumber < 1) {
    return NextResponse.json({ error: "waveNumber must be a positive integer" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  if (action === "reject" && (!rejectionPrompt || !rejectionPrompt.trim())) {
    return NextResponse.json(
      { error: "rejectionPrompt est requis pour rejeter une wave." },
      { status: 400 }
    );
  }

  try {
    let review;
    if (action === "approve") {
      review = await approveWaveReview(projectId, waveNumber);
    } else {
      review = await rejectWaveReview(projectId, waveNumber, rejectionPrompt!.trim());
    }

    return NextResponse.json({ review }, { status: 200 });
  } catch (err) {
    console.error("[wave-review/PATCH] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update wave review" },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/pipeline/[projectId]/wave-review?wave=N
// Récupère la review d'une wave spécifique.
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const waveNumber = parseInt(req.nextUrl.searchParams.get("wave") ?? "", 10);

  if (isNaN(waveNumber) || waveNumber < 1) {
    return NextResponse.json({ error: "wave query param must be a positive integer" }, { status: 400 });
  }

  const review = await getWaveReview(projectId, waveNumber);
  if (!review) {
    return NextResponse.json({ error: "Wave review not found" }, { status: 404 });
  }

  return NextResponse.json({ review });
}
