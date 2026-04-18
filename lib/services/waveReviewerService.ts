import { callOpenRouter, LLM_MODELS } from "@/lib/config/llm";
import { getTasksByProject } from "@/lib/services/pipelineService";
import { getFileContent } from "@/lib/services/githubService";
import type { PipelineTask } from "@/lib/types/task";
import type { Project } from "@/lib/types/project";

// ============================================================
// Types
// ============================================================

export interface WaveReviewIssue {
  severity: "critical" | "warning";
  file: string;
  description: string;
}

export interface WaveReviewResult {
  waveNumber: number;
  passed: boolean;
  issues: WaveReviewIssue[];
  summary: string;
}

// ============================================================
// Prompt
// ============================================================

function buildReviewPrompt(
  project: Project,
  waveNumber: number,
  waveTasks: PipelineTask[],
  fileContents: { path: string; content: string }[]
): string {
  const filesBlock = fileContents
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const tasksSummary = waveTasks
    .map((t) => `- ${t.backlogRef ?? "?"} | ${t.title} → ${t.deliverablePath ?? "?"}`)
    .join("\n");

  return `Tu es un Lead Developer senior qui fait la revue de code d'une wave de développement.

Jeu : "${project.title}" — ${project.description}
Moteur : ${project.engine} | Genre : ${project.genre}

Wave ${waveNumber} — tâches réalisées :
${tasksSummary}

Fichiers produits dans cette wave :
${filesBlock || "Aucun fichier récupérable."}

Analyse ces fichiers et détecte :
1. Les imports qui pointent vers des fichiers/modules qui n'existent pas dans les fichiers fournis
2. Les fonctions ou classes appelées mais non définies dans le contexte fourni
3. Les incohérences de nommage entre fichiers (ex: exporté sous un nom, importé sous un autre)
4. Les interfaces ou types définis différemment dans deux fichiers

RÈGLES :
- Ne signale QUE les problèmes objectifs et vérifiables dans le code fourni
- Ne critique pas le style, la performance ou l'architecture
- Si les fichiers sont cohérents entre eux, réponds avec passed: true et issues vide
- Sois concis dans les descriptions

Réponds UNIQUEMENT en JSON strict, sans texte avant ni après :
{
  "passed": true,
  "issues": [
    {
      "severity": "critical",
      "file": "src/systems/combat.ts",
      "description": "Import de 'PlayerState' depuis '../state/player' mais ce fichier n'est pas dans le contexte"
    }
  ],
  "summary": "2 imports non résolus dans combat.ts. Le reste est cohérent."
}`;
}

// ============================================================
// Public API
// ============================================================

/**
 * Runs after all tasks in a wave are completed.
 * Reads the files produced by the wave and checks for cross-file inconsistencies.
 * Returns a review result — caller decides whether to block the next wave.
 */
export async function reviewWave(
  project: Project,
  waveNumber: number
): Promise<WaveReviewResult> {
  const allTasks = await getTasksByProject(project.id, "in-dev");
  const waveTasks = allTasks.filter(
    (t) => t.waveNumber === waveNumber && t.status === "completed"
  );

  if (waveTasks.length === 0) {
    return {
      waveNumber,
      passed: true,
      issues: [],
      summary: "Aucune tâche complétée dans cette wave.",
    };
  }

  // Collect file contents — prefer deliverableContent (already in DB), fallback to GitHub
  const fileContents: { path: string; content: string }[] = [];
  const repoName = project.githubRepoName ?? "";

  for (const task of waveTasks) {
    if (!task.deliverablePath) continue;

    const content =
      task.deliverableContent ??
      (repoName ? await getFileContent(repoName, task.deliverablePath) : null);

    if (content) {
      fileContents.push({ path: task.deliverablePath, content });
    }
  }

  if (fileContents.length === 0) {
    return {
      waveNumber,
      passed: true,
      issues: [],
      summary: "Aucun fichier récupérable pour cette wave.",
    };
  }

  const prompt = buildReviewPrompt(project, waveNumber, waveTasks, fileContents);

  const { content: raw } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    { temperature: 0.1, max_tokens: 1200 }
  );

  let parsed: { passed: boolean; issues: WaveReviewIssue[]; summary: string };
  try {
    const cleaned = raw.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
    parsed = JSON.parse(cleaned);
  } catch {
    // Si le JSON est malformé, on laisse passer pour ne pas bloquer
    return {
      waveNumber,
      passed: true,
      issues: [],
      summary: "Revue impossible à parser — wave débloquée par défaut.",
    };
  }

  return {
    waveNumber,
    passed: parsed.passed,
    issues: parsed.issues ?? [],
    summary: parsed.summary ?? "",
  };
}

/**
 * Returns true if the given wave number is the last completed wave
 * and all its tasks are done.
 */
export function isWaveFullyCompleted(
  tasks: PipelineTask[],
  waveNumber: number
): boolean {
  const waveTasks = tasks.filter((t) => t.waveNumber === waveNumber && t.projectPhase === "in-dev");
  return (
    waveTasks.length > 0 &&
    waveTasks.every((t) => t.status === "completed")
  );
}
