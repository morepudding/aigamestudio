import { callOpenRouterWithTools, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import type { Tool, AgentMessage } from "@/lib/config/llm";
import { getFileContent, pushFile, listFiles } from "@/lib/services/githubService";
import type { Project } from "@/lib/types/project";
import type { PipelineTask } from "@/lib/types/task";

// ============================================================
// Types
// ============================================================

export interface CodingResult {
  success: boolean;
  filesWritten: string[];
  summary: string;
  tokensUsed: number;
  iterations: number;
}

// ============================================================
// Abort registry — allows cancelling running tasks
// ============================================================

const runningTasks = new Map<string, AbortController>();

export function cancelTask(taskId: string): boolean {
  const controller = runningTasks.get(taskId);
  if (controller) {
    controller.abort();
    runningTasks.delete(taskId);
    return true;
  }
  return false;
}

export function isTaskRunning(taskId: string): boolean {
  return runningTasks.has(taskId);
}

// ============================================================
// Tools
// ============================================================

const CODING_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Lire le contenu d'un fichier dans le repo GitHub du projet",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Chemin du fichier (ex: src/core/game_manager.gd)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Créer ou remplacer un fichier dans le repo GitHub du projet",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Chemin du fichier à écrire (ex: src/systems/dialogue.gd)",
          },
          content: {
            type: "string",
            description: "Contenu complet du fichier",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Lister les fichiers et dossiers dans un répertoire du repo",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Chemin du dossier (ex: src/ ou src/systems)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_complete",
      description:
        "Signaler que la tâche est terminée. Appeler UNIQUEMENT quand tous les fichiers nécessaires ont été écrits.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Résumé des fichiers créés ou modifiés et de leur rôle",
          },
          files_written: {
            type: "array",
            items: { type: "string" },
            description: "Liste des chemins de fichiers écrits",
          },
        },
        required: ["summary", "files_written"],
      },
    },
  },
];

// ============================================================
// System prompt builder
// ============================================================

function buildSystemPrompt(
  project: Project,
  task: PipelineTask,
  docs: { gdd: string | null; techSpec: string | null; dataArch: string | null },
  contextFiles: { path: string; content: string }[],
  skillPrompt?: string | null
): string {
  const docsBlock = [
    docs.gdd && `=== GAME DESIGN DOCUMENT ===\n${docs.gdd}`,
    docs.techSpec && `=== SPÉCIFICATION TECHNIQUE ===\n${docs.techSpec}`,
    docs.dataArch && `=== ARCHITECTURE DATA & ÉTAT ===\n${docs.dataArch}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const contextBlock =
    contextFiles.length > 0
      ? `=== FICHIERS EXISTANTS ===\n\n${contextFiles
          .map((f) => `--- ${f.path} ---\n${f.content}`)
          .join("\n\n")}`
      : "";

  const backlogLine = task.backlogRef ? `\nRéférence backlog : ${task.backlogRef}` : "";

  // Bloc prompt compétence — injecté uniquement s'il existe (post-mortem validé)
  const skillBlock = skillPrompt
    ? `\n=== RÈGLES COMPÉTENCE (issues des post-mortems précédents) ===\n${skillPrompt}\n`
    : "";

  return `Tu es un développeur expert ${project.engine} dans un studio de jeu vidéo indépendant.

PROJET : "${project.title}"
Description : ${project.description}
Moteur : ${project.engine} | Genre : ${project.genre} | Plateformes : ${project.platforms.join(", ")}${backlogLine}

${docsBlock}

${contextBlock}
${skillBlock}
OUTILS DISPONIBLES :
- read_file(path) : lire un fichier du repo
- write_file(path, content) : écrire un fichier dans le repo
- list_files(path) : lister les fichiers d'un dossier
- task_complete(summary, files_written) : signaler la fin de la tâche

INSTRUCTIONS :
1. COMMENCE par explorer le repo avec list_files / read_file pour comprendre la structure existante
2. Écris TOUS les fichiers nécessaires avec write_file — plusieurs fichiers si besoin
3. Le code doit être fonctionnel, complet et cohérent entre les fichiers (aucun import manquant)
4. Respecte la stack et les conventions définies dans la spécification technique
5. Les commentaires de code sont en français
6. Aucun TODO ni placeholder — du code fonctionnel uniquement
7. Quand tous les fichiers sont écrits, appelle task_complete`;
}

// ============================================================
// Agentic loop
// ============================================================

const MAX_ITERATIONS = 20;

export async function executeCodeTask(
  task: PipelineTask,
  project: Project,
  docs: { gdd: string | null; techSpec: string | null; dataArch: string | null },
  contextFiles: { path: string; content: string }[],
  skillPrompt?: string | null
): Promise<CodingResult> {
  if (!project.githubRepoName) {
    throw new Error("Project has no GitHub repo");
  }
  const repoName = project.githubRepoName;

  // Set up abort controller for this task
  const abortController = new AbortController();
  runningTasks.set(task.id, abortController);

  // Buffer local des fichiers écrits — on commit vers GitHub quand task_complete est appelé
  const pendingWrites = new Map<string, string>();
  let totalTokens = 0;

  const messages: AgentMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(project, task, docs, contextFiles, skillPrompt),
    },
    {
      role: "user",
      content: `Réalise cette tâche de développement :\n\nTitre : ${task.title}\nDescription : ${task.description}`,
    },
  ];

  try {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Check if cancelled before each iteration
    if (abortController.signal.aborted) {
      throw new Error("Task cancelled by user");
    }

    const response = await callOpenRouterWithTools(
      LLM_MODELS.code,
      messages,
      CODING_TOOLS,
      LLM_PARAMS.code,
      abortController.signal
    );

    totalTokens += response.tokensUsed ?? 0;

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // Pas de tool calls → l'agent a terminé sa réponse sans appeler task_complete
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      break;
    }

    // Exécuter chaque tool call séquentiellement
    for (const toolCall of assistantMessage.tool_calls) {
      const { name, arguments: argsStr } = toolCall.function;

      let toolResult: string;
      try {
        const args = JSON.parse(argsStr);

        switch (name) {
          case "read_file": {
            // Lire depuis le buffer local d'abord (fichier écrit dans cette session)
            const buffered = pendingWrites.get(args.path as string);
            if (buffered !== undefined) {
              toolResult = buffered;
            } else {
              const content = await getFileContent(repoName, args.path as string);
              toolResult = content ?? `[ERREUR] Fichier non trouvé : ${args.path}`;
            }
            break;
          }

          case "write_file": {
            pendingWrites.set(args.path as string, args.content as string);
            toolResult = `OK — ${args.path} enregistré (${(args.content as string).length} caractères)`;
            break;
          }

          case "list_files": {
            const files = await listFiles(repoName, args.path as string);
            toolResult =
              files.length > 0 ? files.join("\n") : "(dossier vide ou inexistant)";
            break;
          }

          case "task_complete": {
            // Commit tous les fichiers en attente sur GitHub
            for (const [filePath, content] of pendingWrites) {
              await pushFile(
                repoName,
                filePath,
                content,
                `[eden] ${task.title}: ${filePath}`
              );
            }
            return {
              success: true,
              filesWritten: (args.files_written as string[]) ?? [...pendingWrites.keys()],
              summary: args.summary as string,
              tokensUsed: totalTokens,
              iterations: i + 1,
            };
          }

          default:
            toolResult = `[ERREUR] Tool inconnu : ${name}`;
        }
      } catch (e) {
        toolResult = `[ERREUR] Impossible d'exécuter le tool ${name}: ${e instanceof Error ? e.message : String(e)}`;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  // MAX_ITERATIONS atteint : commit ce qui a été écrit quand même
  if (pendingWrites.size > 0) {
    for (const [filePath, content] of pendingWrites) {
      await pushFile(
        repoName,
        filePath,
        content,
        `[eden] ${task.title}: ${filePath}`
      );
    }
  }

  return {
    success: pendingWrites.size > 0,
    filesWritten: [...pendingWrites.keys()],
    summary: `Agent terminé après ${MAX_ITERATIONS} itérations (limite atteinte)`,
    tokensUsed: totalTokens,
    iterations: MAX_ITERATIONS,
  };
  } finally {
    runningTasks.delete(task.id);
  }
}
