com# Handoff vers un Coding Agent — Spécification d'implémentation

## Contexte

Eden Studio excelle dans la phase **conception** : chat avec les agents IA, prise de décisions directeur, génération de documents structurés (GDD, Tech Spec, Data Architecture, Asset List, Backlog) poussés sur un repo GitHub.

Pour la phase **développement**, plutôt que de laisser les agents Eden générer du code (fragile, sans tests, sans feedback loop), on délègue à un **coding agent spécialisé** via OpenRouter.

## Architecture choisie : Export contexte structuré + coding agent via OpenRouter

```
Eden Studio (conception)
    │
    ├── GDD, Tech Spec, Data Arch, Asset List, Backlog → GitHub repo
    │
    ├── eden-context.json → GitHub repo (contexte structuré pour le coding agent)
    │
    └── Quand une task "code" est exécutée :
            │
            ├── 1. Construire le prompt avec le contexte projet complet
            ├── 2. Appeler un modèle de code via OpenRouter
            ├── 3. Parser la réponse (fichiers générés)
            └── 4. Pousser les fichiers sur GitHub
```

## Modèles de code disponibles via OpenRouter

| Modèle | ID OpenRouter | Forces | Contexte | Prix approx. |
|--------|--------------|--------|----------|--------------|
| **Claude Sonnet 4** | `anthropic/claude-sonnet-4` | Excellent en code, raisonnement | 200k | ~$3/12 per M tokens |
| **DeepSeek V3** | `deepseek/deepseek-chat-v3-0324` | Bon rapport qualité/prix, déjà utilisé | 128k | ~$0.27/1.10 per M tokens |
| **Qwen 2.5 Coder 32B** | `qwen/qwen-2.5-coder-32b-instruct` | Spécialisé code, très bon | 32k | ~$0.20/0.20 per M tokens |
| **DeepSeek R1** | `deepseek/deepseek-r1` | Raisonnement profond, code complexe | 64k | ~$0.55/2.19 per M tokens |

**Recommandation** : Utiliser `deepseek/deepseek-chat-v3-0324` par défaut (déjà dans le stack, bon rapport qualité/prix). Possibilité de passer sur Claude Sonnet 4 ou DeepSeek R1 pour les tâches complexes.

## eden-context.json — Format d'export

Fichier généré et poussé dans le repo à chaque lancement de la phase dev. Contient tout le contexte nécessaire pour un coding agent.

```json
{
  "version": "1.0",
  "project": {
    "title": "First Light",
    "description": "...",
    "engine": "Godot 4.4",
    "genre": "RPG narratif",
    "platforms": ["PC", "Switch"]
  },
  "documents": {
    "gdd": "docs/gdd.md",
    "techSpec": "docs/tech-spec.md",
    "dataArch": "docs/data-arch.md",
    "assetList": "docs/asset-list.md",
    "backlog": "docs/backlog.md"
  },
  "currentTask": {
    "id": "uuid",
    "title": "Implémenter le système de dialogue",
    "description": "...",
    "backlogRef": "BACK-003",
    "deliverablePath": "src/dialogue/dialogue_manager.gd",
    "deliverableType": "code",
    "dependsOn": ["uuid-prev-task"],
    "contextFiles": ["src/core/game_manager.gd", "src/data/dialogue_data.gd"]
  },
  "completedTasks": [
    {
      "title": "Structure de base du projet",
      "deliverablePath": "src/core/game_manager.gd",
      "status": "completed"
    }
  ],
  "decisions": [
    {
      "question": "Quel système de dialogue ?",
      "answer": "Dialogue basé sur des graphes avec Ink"
    }
  ]
}
```

## Implémentation dans le code existant

### 1. Ajouter le modèle de code dans `lib/config/llm.ts`

```typescript
export const LLM_MODELS = {
  chat: "deepseek/deepseek-chat-v3-0324",
  tasks: "deepseek/deepseek-chat-v3-0324",
  code: "deepseek/deepseek-chat-v3-0324",  // modèle pour les tasks de code
} as const;

export const LLM_PARAMS = {
  // ...existant...
  code: {
    temperature: 0.2,      // plus déterministe pour du code
    max_tokens: 8192,      // fichiers plus longs
  },
} as const;
```

### 2. Modifier `executeDevTask()` dans `producerService.ts`

Le flux actuel de `executeDevTask` est déjà bon :
- Lit les docs de contexte (GDD, tech spec, data arch)
- Collecte les dépendances complétées
- Construit un prompt
- Appelle OpenRouter
- Retourne le contenu

**Changements nécessaires** :
- Utiliser `LLM_MODELS.code` au lieu de `LLM_MODELS.tasks`
- Utiliser `LLM_PARAMS.code` pour les paramètres
- Enrichir le prompt avec des instructions de coding plus strictes
- Ajouter la génération de `eden-context.json` avant l'exécution

### 3. Générer `eden-context.json` — nouvelle fonction dans `producerService.ts`

```typescript
export async function generateEdenContext(
  project: Project,
  task: PipelineTask,
  completedTasks: PipelineTask[],
  decisions: ProjectDecision[]
): Promise<string> {
  const context = {
    version: "1.0",
    project: {
      title: project.title,
      description: project.description,
      engine: project.engine,
      genre: project.genre,
      platforms: project.platforms,
    },
    documents: {
      gdd: "docs/gdd.md",
      techSpec: "docs/tech-spec.md",
      dataArch: "docs/data-arch.md",
      assetList: "docs/asset-list.md",
      backlog: "docs/backlog.md",
    },
    currentTask: {
      id: task.id,
      title: task.title,
      description: task.description,
      backlogRef: task.backlogRef,
      deliverablePath: task.deliverablePath,
      deliverableType: task.deliverableType,
      dependsOn: task.dependsOn,
      contextFiles: task.llmContextFiles,
    },
    completedTasks: completedTasks.map(t => ({
      title: t.title,
      deliverablePath: t.deliverablePath,
      status: t.status,
    })),
    decisions: decisions.map(d => ({
      question: d.question,
      answer: d.answer,
    })),
  };
  return JSON.stringify(context, null, 2);
}
```

### 4. Prompt de code amélioré

```typescript
function buildCodeTaskPrompt(
  project: Project,
  task: PipelineTask,
  docs: { gdd: string | null; techSpec: string | null; dataArch: string | null },
  contextFiles: { path: string; content: string }[]
): string {
  const contextBlock = contextFiles
    .map(f => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  return `Tu es un développeur senior spécialisé en ${project.engine}.
Tu travailles sur le jeu "${project.title}" (${project.genre}).

=== GAME DESIGN DOCUMENT ===
${docs.gdd ?? "(non disponible)"}

=== SPÉCIFICATION TECHNIQUE ===
${docs.techSpec ?? "(non disponible)"}

=== ARCHITECTURE DATA ===
${docs.dataArch ?? "(non disponible)"}

=== FICHIERS DE CONTEXTE ===
${contextBlock || "(aucun)"}

=== TÂCHE À RÉALISER ===
Titre : ${task.title}
Description : ${task.description}
Fichier à produire : ${task.deliverablePath}

RÈGLES :
- Produis UNIQUEMENT le code du fichier demandé
- Le code doit être fonctionnel et complet
- Respecte les conventions du moteur ${project.engine}
- Respecte l'architecture définie dans la spec technique
- Commente le code en français
- Pas d'introduction, pas d'explication — juste le code
- Pas de blocs markdown autour du code`;
}
```

## Étapes d'implémentation (ordre)

1. **Ajouter `LLM_MODELS.code` et `LLM_PARAMS.code`** dans `lib/config/llm.ts`
2. **Ajouter `generateEdenContext()`** dans `producerService.ts`
3. **Créer `buildCodeTaskPrompt()`** dans `producerService.ts` (remplacer/améliorer `buildDevTaskPrompt`)
4. **Modifier `executeDevTask()`** pour utiliser le nouveau modèle et prompt
5. **Pousser `eden-context.json`** dans le repo avant chaque exécution de task code
6. **Tester** sur une task simple (ex: créer un fichier `game_manager.gd`)

## Points clés

- **Tout passe par OpenRouter** — pas de nouveau fournisseur, pas de nouveau compte
- **Même architecture que les docs** — LLM génère, on pousse sur GitHub
- **Pas de complexité CrewAI** — un seul appel LLM par task, pas d'orchestration multi-agent
- **Évolutif** — on peut facilement changer le modèle (DeepSeek → Claude) sans toucher au flow
- **eden-context.json** — permet aussi à un humain avec Cursor/Copilot de reprendre le contexte projet
