# Handoff V2 — Agent de Coding Multi-Fichier via OpenRouter

## Problème avec la V1

La V1 (un appel LLM par fichier, push séparé) ne fonctionne pas pour du vrai code :
- Pas de cohérence entre les fichiers (imports croisés, interfaces partagées)
- Pas de feedback loop (le code ne compile jamais)
- Pas de capacité à lire le code existant ou s'adapter

## Solution : Boucle Agentique avec Tool Calling via OpenRouter

OpenRouter supporte le **tool calling** (function calling) sur les modèles compatibles. On construit un **coding agent** directement dans Eden qui :

1. Reçoit le contexte projet complet (specs + backlog + décisions)
2. Planifie les fichiers à créer/modifier
3. Utilise des **tools** pour lire/écrire dans le repo GitHub
4. Itère en boucle jusqu'à ce que la tâche soit faite
5. Tout est facturé via OpenRouter — un seul fournisseur

```
Eden Pipeline
    │
    ├── Task "in-dev" prête à exécuter
    │
    └── Coding Agent Loop (dans Eden)
            │
            ├── Appel OpenRouter avec tools + contexte projet
            │
            ├── Le modèle décide quels tools appeler :
            │   ├── read_file(path)    → lit un fichier du repo
            │   ├── write_file(path, content)  → écrit/crée un fichier
            │   ├── list_files(dir)    → liste les fichiers d'un dossier
            │   └── task_complete(summary)  → signale la fin
            │
            ├── Eden exécute les tools via GitHub API
            │
            ├── Résultat renvoyé au modèle → prochaine itération
            │
            └── Quand task_complete → commit tout sur GitHub
```

## Modèles recommandés (via OpenRouter, tool calling supporté)

| Modèle | ID OpenRouter | Tool Calling | Contexte | Prix (in/out per M) |
|--------|--------------|:---:|---------|---------------------|
| **Claude Sonnet 4** | `anthropic/claude-sonnet-4` | oui | 200k | $3 / $15 |
| **Claude Haiku 3.5** | `anthropic/claude-3.5-haiku` | oui | 200k | $0.80 / $4 |
| **GPT-4o** | `openai/gpt-4o` | oui | 128k | $2.50 / $10 |
| **GPT-4o-mini** | `openai/gpt-4o-mini` | oui | 128k | $0.15 / $0.60 |
| **DeepSeek V3** | `deepseek/deepseek-chat-v3-0324` | oui | 128k | $0.27 / $1.10 |
| **DeepSeek R1** | `deepseek/deepseek-r1` | non | 64k | — pas de tools |
| **Qwen 2.5 Coder 32B** | `qwen/qwen-2.5-coder-32b-instruct` | oui | 32k | $0.20 / $0.20 |

**Recommandation** :
- **Par défaut** : `deepseek/deepseek-chat-v3-0324` (déjà dans le stack, pas cher, tool calling OK)
- **Pour les tâches complexes** : `anthropic/claude-sonnet-4` (meilleur en code, contexte 200k)
- **Budget serré** : `openai/gpt-4o-mini` ou `qwen/qwen-2.5-coder-32b-instruct`

## Les 4 Tools du Coding Agent

Définis au format OpenAI Function Calling (compatible OpenRouter) :

```typescript
const CODING_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Lire le contenu d'un fichier dans le repo du projet",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin du fichier (ex: src/core/game_manager.gd)" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Créer ou remplacer un fichier dans le repo du projet",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin du fichier à écrire" },
          content: { type: "string", description: "Contenu complet du fichier" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "Lister les fichiers et dossiers dans un répertoire du repo",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin du dossier (ex: src/)" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "task_complete",
      description: "Signaler que la tâche est terminée. Appeler quand tous les fichiers sont écrits.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Résumé des fichiers créés/modifiés" },
          files_written: {
            type: "array",
            items: { type: "string" },
            description: "Liste des chemins de fichiers écrits"
          }
        },
        required: ["summary", "files_written"]
      }
    }
  }
];
```

## Boucle Agentique — Implémentation

Le cœur du système. À ajouter dans `producerService.ts` (ou un nouveau `codingAgentService.ts`).

```typescript
// lib/services/codingAgentService.ts

import { callOpenRouterWithTools } from "@/lib/config/llm";
import { getFileContent, pushFile, listFiles } from "@/lib/services/githubService";
import type { Project } from "@/lib/types/project";
import type { PipelineTask } from "@/lib/types/task";

interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface CodingResult {
  success: boolean;
  filesWritten: string[];
  summary: string;
  totalTokens: number;
  iterations: number;
}

const MAX_ITERATIONS = 20;

export async function executeCodeTask(
  task: PipelineTask,
  project: Project,
  contextDocs: { gdd: string | null; techSpec: string | null; dataArch: string | null },
  contextFiles: { path: string; content: string }[]
): Promise<CodingResult> {

  const repoName = project.githubRepoName!;

  // Buffer des fichiers écrits (on commit tout à la fin)
  const pendingWrites: Map<string, string> = new Map();
  let totalTokens = 0;

  // Message système avec tout le contexte projet
  const systemPrompt = buildCodingSystemPrompt(project, task, contextDocs, contextFiles);

  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Réalise cette tâche : ${task.title}\n\n${task.description}` }
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Appel OpenRouter avec tools
    const response = await callOpenRouterWithTools(
      LLM_MODELS.code,
      messages,
      CODING_TOOLS,
      { temperature: 0.2, max_tokens: 8192 }
    );

    totalTokens += response.tokensUsed ?? 0;
    const choice = response.choices[0].message;

    // Ajouter la réponse de l'assistant à l'historique
    messages.push(choice);

    // Pas de tool calls → l'agent a terminé (ou erreur)
    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      break;
    }

    // Exécuter chaque tool call
    for (const toolCall of choice.tool_calls) {
      const { name, arguments: argsStr } = toolCall.function;
      const args = JSON.parse(argsStr);
      let toolResult: string;

      switch (name) {
        case "read_file": {
          // Lire depuis le buffer local d'abord, sinon depuis GitHub
          const cached = pendingWrites.get(args.path);
          if (cached) {
            toolResult = cached;
          } else {
            const content = await getFileContent(repoName, args.path);
            toolResult = content ?? `[ERREUR] Fichier non trouvé : ${args.path}`;
          }
          break;
        }

        case "write_file": {
          pendingWrites.set(args.path, args.content);
          toolResult = `OK — fichier ${args.path} enregistré (${args.content.length} chars)`;
          break;
        }

        case "list_files": {
          const files = await listFiles(repoName, args.path);
          toolResult = files.length > 0 ? files.join("\n") : "(dossier vide)";
          break;
        }

        case "task_complete": {
          // Commit tous les fichiers en attente sur GitHub
          for (const [path, content] of pendingWrites) {
            await pushFile(repoName, path, content, `[eden] ${task.title}: ${path}`);
          }
          return {
            success: true,
            filesWritten: args.files_written ?? [...pendingWrites.keys()],
            summary: args.summary,
            totalTokens,
            iterations: i + 1,
          };
        }

        default:
          toolResult = `[ERREUR] Tool inconnu : ${name}`;
      }

      // Renvoyer le résultat du tool au modèle
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  // Si on atteint MAX_ITERATIONS, commit ce qu'on a quand même
  if (pendingWrites.size > 0) {
    for (const [path, content] of pendingWrites) {
      await pushFile(repoName, path, content, `[eden] ${task.title}: ${path}`);
    }
  }

  return {
    success: pendingWrites.size > 0,
    filesWritten: [...pendingWrites.keys()],
    summary: `Agent terminé après ${MAX_ITERATIONS} itérations`,
    totalTokens,
    iterations: MAX_ITERATIONS,
  };
}
```

## Modifications à `lib/config/llm.ts`

Ajouter le modèle code + la fonction `callOpenRouterWithTools` :

```typescript
export const LLM_MODELS = {
  chat: "deepseek/deepseek-chat-v3-0324",
  tasks: "deepseek/deepseek-chat-v3-0324",
  code: "deepseek/deepseek-chat-v3-0324",  // upgrade vers claude-sonnet-4 si besoin
} as const;

export const LLM_PARAMS = {
  // ...existant...
  code: {
    temperature: 0.2,
    max_tokens: 8192,
  },
} as const;

// Nouvelle fonction pour les appels avec tools
export async function callOpenRouterWithTools(
  model: string,
  messages: any[],
  tools: any[],
  params?: { temperature?: number; max_tokens?: number }
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not defined");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Eden Studio",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      temperature: params?.temperature,
      max_tokens: params?.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return {
    choices: data.choices,
    tokensUsed: data.usage?.total_tokens ?? null,
  };
}
```

## Modifications à `lib/services/githubService.ts`

Ajouter `listFiles()` (si pas déjà présent) :

```typescript
export async function listFiles(repoName: string, path: string): Promise<string[]> {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: repoName,
      path: path.replace(/\/$/, ""),
    });
    if (!Array.isArray(data)) return [path]; // C'est un fichier, pas un dossier
    return data.map(item => item.path);
  } catch {
    return [];
  }
}
```

## Modifications à `execute/route.ts`

Remplacer l'appel à `executeDevTask` par le nouvel agent :

```typescript
if (task.projectPhase === "in-dev") {
  const { executeCodeTask } = await import("@/lib/services/codingAgentService");
  const result = await executeCodeTask(task, project, contextDocs, contextFiles);

  // Sauvegarder le résultat
  llmOutput = result.summary;
  tokensUsed = result.totalTokens;

  // Log les fichiers écrits
  console.log(`[CodingAgent] ${result.filesWritten.length} files, ${result.iterations} iterations`);
}
```

## Prompt Système du Coding Agent

```typescript
function buildCodingSystemPrompt(
  project: Project,
  task: PipelineTask,
  docs: { gdd: string | null; techSpec: string | null; dataArch: string | null },
  contextFiles: { path: string; content: string }[]
): string {
  const docsBlock = [
    docs.gdd && `=== GDD ===\n${docs.gdd}`,
    docs.techSpec && `=== SPEC TECHNIQUE ===\n${docs.techSpec}`,
    docs.dataArch && `=== ARCHITECTURE DATA ===\n${docs.dataArch}`,
  ].filter(Boolean).join("\n\n");

  const contextBlock = contextFiles
    .map(f => `=== ${f.path} ===\n${f.content}`)
    .join("\n\n");

  return `Tu es un développeur expert ${project.engine} dans un studio de jeu vidéo.

PROJET : "${project.title}" — ${project.description}
Moteur : ${project.engine} | Genre : ${project.genre} | Plateformes : ${project.platforms.join(", ")}

${docsBlock}

${contextBlock ? `FICHIERS EXISTANTS :\n${contextBlock}` : ""}

INSTRUCTIONS :
- Tu as accès à des tools pour lire et écrire des fichiers dans le repo GitHub du projet
- COMMENCE par lire les fichiers existants pertinents avec read_file / list_files
- Ensuite, écris TOUS les fichiers nécessaires avec write_file
- Le code doit être fonctionnel, complet, et cohérent entre les fichiers
- Respecte la stack et l'architecture définies dans la spec technique
- Commentaires en français
- Quand tu as terminé, appelle task_complete avec un résumé
- NE GÉNÈRE PAS de placeholders ou de TODO — du vrai code fonctionnel`;
}
```

## Flux Complet — Comment ça marche concrètement

```
1. User clique "Exécuter" sur une tâche in-dev dans le pipeline UI
        ↓
2. POST /api/pipeline/task/[id]/execute
        ↓
3. Détecte projectPhase === "in-dev" → appelle executeCodeTask()
        ↓
4. Boucle agentique :
   │  Itération 1 : Le modèle appelle list_files("src/")
   │  → Eden exécute via GitHub API → renvoie la liste
   │
   │  Itération 2 : Le modèle appelle read_file("src/core/game.gd")
   │  → Eden lit via GitHub API → renvoie le contenu
   │
   │  Itération 3 : Le modèle appelle write_file("src/systems/dialogue.gd", "...")
   │                          + write_file("src/data/dialogue_data.gd", "...")
   │  → Eden bufferise les écritures
   │
   │  Itération 4 : Le modèle appelle task_complete(summary, files)
   │  → Eden commit tous les fichiers sur GitHub en séquence
        ↓
5. Résultat sauvé en DB (summary, tokens, fichiers)
        ↓
6. UI met à jour le statut de la tâche → "completed" ou "review"
```

## Coût estimé par tâche

Avec DeepSeek V3, une tâche de 4–5 itérations avec ~10k tokens input / ~3k output :
- **~$0.006 par tâche** (~0.6 centime)
- Un pipeline de 20 tâches : **~$0.12**

Avec Claude Sonnet 4 :
- **~$0.07 par tâche**
- Un pipeline de 20 tâches : **~$1.40**

## Étapes d'implémentation

1. **`callOpenRouterWithTools()`** dans `lib/config/llm.ts` — ajouter le support tools
2. **`listFiles()`** dans `lib/services/githubService.ts` — si pas déjà présent
3. **`lib/services/codingAgentService.ts`** — nouveau fichier avec la boucle agentique
4. **Modifier `execute/route.ts`** — brancher le coding agent pour les tâches in-dev
5. **Ajouter `LLM_MODELS.code`** dans la config LLM
6. **Tester** sur une tâche simple (créer 2-3 fichiers qui s'importent mutuellement)

## Limites connues et évolutions futures

- **Pas de tests automatiques** : l'agent ne peut pas compiler/exécuter le code. Évolution possible : ajouter un tool `run_command` si on a un sandbox.
- **Commit fichier par fichier** : idéalement, on voudrait un seul commit atomique (utiliser la Git Trees API comme `initRepoStructure` fait déjà).
- **Pas de lecture de l'état du monde** : l'agent ne voit que le repo. Pas d'accès au runtime, aux logs, etc.
- **Token limit** : pour un gros projet, le contexte (GDD + spec + data arch + fichiers existants) peut dépasser la fenêtre. → Résumé automatique ou sélection intelligente du contexte.
