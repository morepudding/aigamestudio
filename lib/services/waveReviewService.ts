import { supabase } from "@/lib/supabase/client";
import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import type { PipelineTask } from "@/lib/types/task";
import type { Project } from "@/lib/types/project";

// ============================================================
// Types
// ============================================================

export interface WaveReview {
  id: string;
  projectId: string;
  waveNumber: number;
  screenshotUrl: string | null;
  screenshotTakenAt: string | null;
  pagesUrl: string | null;
  reportMarkdown: string | null;
  reportGeneratedAt: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionPrompt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToReview(row: any): WaveReview {
  return {
    id: row.id,
    projectId: row.project_id,
    waveNumber: row.wave_number,
    screenshotUrl: row.screenshot_url ?? null,
    screenshotTakenAt: row.screenshot_taken_at ?? null,
    pagesUrl: row.pages_url ?? null,
    reportMarkdown: row.report_markdown ?? null,
    reportGeneratedAt: row.report_generated_at ?? null,
    status: row.status,
    rejectionPrompt: row.rejection_prompt ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// Queries
// ============================================================

export async function getWaveReview(
  projectId: string,
  waveNumber: number
): Promise<WaveReview | null> {
  const { data, error } = await supabase
    .from("wave_reviews")
    .select("*")
    .eq("project_id", projectId)
    .eq("wave_number", waveNumber)
    .single();

  if (error || !data) return null;
  return rowToReview(data);
}

export async function getLatestWaveReview(projectId: string): Promise<WaveReview | null> {
  const { data, error } = await supabase
    .from("wave_reviews")
    .select("*")
    .eq("project_id", projectId)
    .order("wave_number", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return rowToReview(data);
}

export async function getAllWaveReviews(projectId: string): Promise<WaveReview[]> {
  const { data, error } = await supabase
    .from("wave_reviews")
    .select("*")
    .eq("project_id", projectId)
    .order("wave_number", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToReview);
}

// ============================================================
// Création / mise à jour
// ============================================================

export async function upsertWaveReview(
  projectId: string,
  waveNumber: number,
  patch: Partial<Omit<WaveReview, "id" | "projectId" | "waveNumber" | "createdAt" | "updatedAt">>
): Promise<WaveReview> {
  const { data, error } = await supabase
    .from("wave_reviews")
    .upsert(
      {
        project_id: projectId,
        wave_number: waveNumber,
        screenshot_url: patch.screenshotUrl,
        screenshot_taken_at: patch.screenshotTakenAt,
        pages_url: patch.pagesUrl,
        report_markdown: patch.reportMarkdown,
        report_generated_at: patch.reportGeneratedAt,
        status: patch.status ?? "pending",
        rejection_prompt: patch.rejectionPrompt,
        reviewed_at: patch.reviewedAt,
      },
      { onConflict: "project_id,wave_number" }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert wave review: ${error?.message}`);
  }
  return rowToReview(data);
}

// ============================================================
// Actions utilisateur
// ============================================================

/**
 * Approuve la review d'une wave.
 * La prochaine wave peut maintenant être générée.
 */
export async function approveWaveReview(
  projectId: string,
  waveNumber: number
): Promise<WaveReview> {
  return upsertWaveReview(projectId, waveNumber, {
    status: "approved",
    reviewedAt: new Date().toISOString(),
  });
}

/**
 * Rejette la review d'une wave avec un prompt correctionnel.
 * Injecte le feedback dans les llmPromptTemplate des tâches de cette wave
 * pour que la regénération en tienne compte.
 */
export async function rejectWaveReview(
  projectId: string,
  waveNumber: number,
  rejectionPrompt: string
): Promise<WaveReview> {
  const review = await upsertWaveReview(projectId, waveNumber, {
    status: "rejected",
    rejectionPrompt,
    reviewedAt: new Date().toISOString(),
  });

  // Injecter le feedback dans les prompts des tâches de la wave rejetée
  const { data: waveTasks } = await supabase
    .from("pipeline_tasks")
    .select("id, llm_prompt_template")
    .eq("project_id", projectId)
    .eq("wave_number", waveNumber);

  if (waveTasks && waveTasks.length > 0) {
    const feedbackBlock = `\n\n---\n**Feedback de correction (rejet wave ${waveNumber}) :**\n${rejectionPrompt}`;
    await Promise.all(
      waveTasks.map((t) => {
        const updatedPrompt = (t.llm_prompt_template ?? "") + feedbackBlock;
        return supabase
          .from("pipeline_tasks")
          .update({ llm_prompt_template: updatedPrompt })
          .eq("id", t.id);
      })
    );
  }

  return review;
}

/**
 * Récupère le prompt de rejet de la wave précédente, si elle existe.
 * Utilisé pour enrichir le contexte de génération de la prochaine wave.
 */
export async function getPreviousRejectionPrompt(
  projectId: string,
  currentWaveNumber: number
): Promise<string | null> {
  const review = await getWaveReview(projectId, currentWaveNumber - 1);
  if (!review || review.status !== "rejected") return null;
  return review.rejectionPrompt;
}

// ============================================================
// Rapport LLM
// ============================================================

function buildReportPrompt(
  project: Project,
  waveNumber: number,
  waveTasks: PipelineTask[],
  pagesUrl: string | null
): string {
  const previewLabel = pagesUrl
    ? `URL de prévisualisation : ${pagesUrl}`
    : "Prévisualisation jouable : non disponible pour cette wave";
  const previewInstructions = pagesUrl
    ? `Ce que le directeur devrait voir à l'URL ${pagesUrl} — décris ce qui est jouable/visible à ce stade.`
    : "Indique explicitement qu'aucun build jouable n'est encore publié pour cette wave et décris à la place les livrables techniques/fonctionnels déjà prêts.";

  const tasksSummary = waveTasks
    .map(
      (t) =>
        `- **${t.title}**${t.backlogRef ? ` (${t.backlogRef})` : ""} — ${t.status === "completed" ? "✅ Terminé" : "⚠️ " + t.status}${t.deliverablePath ? `\n  Fichier : \`${t.deliverablePath}\`` : ""}`
    )
    .join("\n");

  return `Tu es un Producer senior dans un studio de jeu vidéo.
Tu dois rédiger un rapport de fin de wave pour que le directeur du studio puisse valider ou corriger avant de passer à la suite.

Projet : "${project.title}"
Description : ${project.description}
Wave : ${waveNumber}
${previewLabel}

Tâches réalisées dans cette wave :
${tasksSummary}

Rédige un rapport de wave concis en Markdown avec cette structure exacte :

## Wave ${waveNumber} — Rapport de livraison

### Résumé
2-3 phrases décrivant ce qui a été réalisé et l'état général du projet.

### Livraisons
Liste des fichiers produits et leur rôle dans le jeu.

### État de la prévisualisation
${previewInstructions}

### Points d'attention
Éléments potentiellement à corriger ou à surveiller avant la prochaine wave (bugs connus, décisions arbitraires, manques).

### Prochaines étapes suggérées
Ce que la prochaine wave devrait prioriser.

RÈGLES :
- Sois factuel et précis, pas générique
- Max 400 mots
- Markdown brut, pas de blocs de code autour du document
- Langue : Français
- Ne réponds QUE avec le contenu du rapport`;
}

/**
 * Génère un rapport LLM pour une wave terminée.
 */
export async function generateWaveReport(
  project: Project,
  waveNumber: number,
  waveTasks: PipelineTask[],
  pagesUrl: string | null
): Promise<string> {
  const prompt = buildReportPrompt(project, waveNumber, waveTasks, pagesUrl);

  const { content } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    { ...LLM_PARAMS.tasks, max_tokens: 1024 }
  );

  return content.trim();
}
