import { callOpenRouter, LLM_MODELS, LLM_PARAMS } from "@/lib/config/llm";
import {
  GDD_TEMPLATE,
  TECH_SPEC_TEMPLATE,
  BACKLOG_TEMPLATE,
  README_TEMPLATE,
} from "@/lib/prompts/templates/docs";
import { createTask, getTasksByProject, advancePipeline, updateTaskPrompt } from "@/lib/services/pipelineService";
import { getAllAgents } from "@/lib/services/agentService";
import { getSessionByProject } from "@/lib/services/brainstormingService";
import { buildAuditPrompt } from "@/lib/prompts/gddReview";
import { normalizeMarkdownDeliverable } from "@/lib/utils";
import type { Project } from "@/lib/types/project";
import type { PipelineTask, DeliverableType } from "@/lib/types/task";
import type { Agent } from "@/lib/services/agentService";
import type { RepoTextFileSnapshot } from "@/lib/services/githubService";

// ============================================================
// Concept doc definitions (order matters — sequential deps)
// ============================================================

interface ConceptDocDef {
  sortOrder: number;
  title: string;
  description: string;
  deliverablePath: string;
  requiresReview: boolean;
  agentDepartment: string;
  promptBuilder: (project: Project) => string;
}

const CONCEPT_DOCS: ConceptDocDef[] = [
  {
    sortOrder: 1,
    title: "Game Design Document",
    description:
      "Rédige le GDD complet du mini-jeu web : vision, gameplay, univers du cours espion, structure et contraintes.",
    deliverablePath: "docs/gdd.md",
    requiresReview: true,
    agentDepartment: "game-design",
    promptBuilder: (p) => buildDocPrompt(p, "Game Designer senior", GDD_TEMPLATE),
  },
  {
    sortOrder: 2,
    title: "Spécification Technique",
    description:
      "Rédige la spec technique web : stack (Phaser/Canvas/vanilla), architecture, systèmes, performance et intégration VN.",
    deliverablePath: "docs/tech-spec.md",
    requiresReview: true,
    agentDepartment: "programming",
    promptBuilder: (p) => buildDocPrompt(p, "Lead Developer web senior", TECH_SPEC_TEMPLATE),
  },
  {
    sortOrder: 3,
    title: "Backlog de Développement",
    description:
      "Génère le backlog complet : items dev, dépendances et waves estimées.",
    deliverablePath: "docs/backlog.md",
    requiresReview: true,
    agentDepartment: "production",
    promptBuilder: (p) => buildBacklogPrompt(p),
  },
  {
    sortOrder: 4,
    title: "Design du Cours & Intégration VN",
    description:
      "Rédige le design pédagogique du cours espion et la spec d'intégration complète avec le visual novel (API postMessage, scoring, états).",
    deliverablePath: "docs/course-design.md",
    requiresReview: true,
    agentDepartment: "narrative",
    promptBuilder: (p) => buildCourseDesignPrompt(p),
  },
  {
    sortOrder: 5,
    title: "README",
    description:
      "Rédige le README public du mini-jeu : pitch joueur, ambiance du cours espion, boucle de jeu — sans jargon technique.",
    deliverablePath: "README.md",
    requiresReview: true,
    agentDepartment: "game-design",
    promptBuilder: (p) => buildReadmePrompt(p),
  },
];

// ============================================================
// Prompt builders
// ============================================================

const TRIPLE_BACKTICK = "```";

/** Bloc contextuel Université d'Espions injecté dans tous les prompts de la pipeline. */
function buildSpyUniversityContext(project: Project): string {
  const lines: string[] = [
    "CONTEXTE STUDIO — Université d'Espions :",
    "Ce studio développe EXCLUSIVEMENT des mini-jeux web destinés à s'intégrer dans un visual novel (VN) sur le thème d'une université d'espions.",
    "Chaque projet = un cours de l'université = un mini-jeu web jouable depuis un navigateur.",
  ];
  if (project.courseInfo) {
    lines.push(`Cours : "${project.courseInfo.courseName}" | Module VN : ${project.courseInfo.vnModule}`);
    if (project.courseInfo.mechanics.length > 0) {
      lines.push(`Mécaniques clés : ${project.courseInfo.mechanics.join(", ")}`);
    }
    if (project.courseInfo.webEngine) {
      lines.push(`Engine web cible : ${project.courseInfo.webEngine}`);
    }
  }
  lines.push("Toutes les décisions techniques et de design doivent servir CET objectif.");
  return lines.join("\n");
}

function buildDocPrompt(project: Project, role: string, template: string): string {
  const spyContext = buildSpyUniversityContext(project);

  return `Tu es ${role} dans un studio de jeu vidéo indépendant.

${spyContext}

Tu travailles sur le mini-jeu "${project.title}" : ${project.description}
Moteur : ${project.engine} | Plateformes : ${project.platforms.join(", ")} | Genre : ${project.genre}

Rédige le document demandé en suivant EXACTEMENT cette structure :

${template.replace(/{titre}/g, project.title)}

RÈGLES IMPÉRATIVES :
- Sois spécifique à CE mini-jeu web et à son cours espion, aucun contenu générique
- Chaque section doit être actionnable pour un développeur web
- Utilise des exemples concrets adaptés au genre "${project.genre}" et au thème espion
- Garde toujours en tête que ce jeu doit fonctionner dans un navigateur et s'intégrer dans un VN
- Format : Markdown propre, listes à puces, tableaux si pertinents
- Rends le markdown BRUT, sans bloc ${TRIPLE_BACKTICK}markdown, sans backticks d'encapsulation, sans guillemets autour du document
- N'échappe jamais le document sous forme de chaîne avec des \n ou du JSON
- Langue : Français
- MAX 3000 mots
- Ne réponds QUE avec le contenu du document, sans introduction ni commentaire`;
}

function buildBacklogPrompt(project: Project): string {
  const spyContext = buildSpyUniversityContext(project);

  return `Tu es le Producer d'un studio de jeu vidéo indépendant.

${spyContext}

Tu travailles sur le mini-jeu "${project.title}" : ${project.description}
Moteur : ${project.engine} | Plateformes : ${project.platforms.join(", ")} | Genre : ${project.genre}

Génère le backlog de développement complet en suivant EXACTEMENT cette structure :

${BACKLOG_TEMPLATE.replace(/{titre}/g, project.title)}

RÈGLES IMPÉRATIVES :
- Minimum 15 items couvrant core gameplay web, systèmes, UI et assets
- Inclure des items spécifiques à l'intégration VN (postMessage API, scoring, états de complétion)
- Chaque item doit avoir des critères d'acceptation précis
- Les dépendances doivent former un DAG sans cycles
- Le graphe de dépendances final doit lister les waves clairement
- Adapte les items au genre "${project.genre}", au moteur "${project.engine}" et à la plateforme web
- Rends le markdown BRUT, sans bloc ${TRIPLE_BACKTICK}markdown, sans backticks d'encapsulation, sans guillemets autour du document
- N'échappe jamais le document sous forme de chaîne avec des \n ou du JSON
- Langue : Français
- Ne réponds QUE avec le contenu du document, sans introduction ni commentaire`;
}

function buildCourseDesignPrompt(project: Project): string {
  const spyContext = buildSpyUniversityContext(project);
  const courseName = project.courseInfo?.courseName ?? project.title;
  const vnModule = project.courseInfo?.vnModule ?? "Semestre 1";
  const mechanics = project.courseInfo?.mechanics ?? [];
  const webEngine = project.courseInfo?.webEngine ?? "phaser";
  const targetUrl = project.courseInfo?.targetIntegrationUrl ?? "À définir";

  return `Tu es un Narrative Designer et Lead Developer spécialisé intégration dans un studio de jeu vidéo.

${spyContext}

Tu rédiges le document de design du cours et la spec d'intégration VN pour le mini-jeu "${project.title}".
Engine web : ${webEngine} | URL cible d'intégration : ${targetUrl}

Rédige le document en suivant EXACTEMENT cette structure :

# Design du Cours & Intégration VN — ${courseName}

## 1. Identité du Cours
- **Nom du cours** : ${courseName}
- **Module VN** : ${vnModule}
- **Mécaniques** : ${mechanics.length > 0 ? mechanics.join(", ") : "À définir"}
- **Engine web** : ${webEngine}

## 2. Objectif Pédagogique Espion
<!-- Quelle compétence d'espion ce cours enseigne-t-il ? Qu'apprend l'étudiant/agent ? -->

## 3. Scénario Narratif du Cours
<!-- Contexte fictif du cours dans l'université. Qui est le professeur ? Quelle est la mission d'entraînement ? -->

## 4. Structure de Progression
<!-- Les étapes ou niveaux du cours. Comment l'étudiant progresse-t-il ? -->

## 5. Système de Scoring
<!-- Critères de réussite, score minimum, grades (S/A/B/C/F). Formule de calcul. -->

## 6. Résultat dans le VN
<!-- Ce qui change dans le visual novel selon la performance du joueur. Branches narratives débloquées. -->

## 7. Ton & Atmosphère
<!-- Ambiance visuelle et sonore du cours. Registre (sérieux, humoristique, tendu...) -->

---

## 8. Intégration VN — API postMessage

### Événements émis par le mini-jeu
\`\`\`json
{ "type": "GAME_READY" }
{ "type": "GAME_COMPLETED", "score": 0-100, "grade": "S"|"A"|"B"|"C"|"F", "durationMs": number }
{ "type": "GAME_FAILED", "reason": string }
\`\`\`

### Événements reçus par le mini-jeu
\`\`\`json
{ "type": "GAME_START", "studentId": string, "difficulty": "easy"|"normal"|"hard" }
{ "type": "GAME_PAUSE" }
{ "type": "GAME_RESUME" }
\`\`\`

## 9. États de Complétion
<!-- États possibles : non tenté, en cours, réussi, échoué. Persistance des scores dans le VN. -->

## 10. Contraintes Techniques d'Intégration
<!-- Dimensions iframe, fps cible, compatibilité navigateurs, assets autorisés. -->

RÈGLES IMPÉRATIVES :
- Le cours doit s'inscrire cohéremment dans l'univers d'une université d'espions
- Reste fidèle aux mécaniques de jeu définies dans le GDD
- Le scoring doit être mesurable et intégrable dans le VN (valeurs normalisées [0-100])
- L'API postMessage doit être exhaustive et typée — permettre au dev VN de l'implémenter sans ambiguïté
- RESPECTE IMPÉRATIVEMENT les décisions du directeur listées ci-dessus
- Rends le markdown BRUT, sans bloc ${TRIPLE_BACKTICK}markdown externe
- Langue : Français
- Ne réponds QUE avec le contenu du document`;
}

function buildReadmePrompt(project: Project): string {
  const spyContext = buildSpyUniversityContext(project);
  const courseName = project.courseInfo?.courseName ?? project.title;

  return `Tu es le Game Designer créatif et copywriter d'un studio de jeu vidéo indépendant.

${spyContext}

Tu travailles sur le mini-jeu "${project.title}" (${courseName}) : ${project.description}
Genre : ${project.genre} | Plateformes : ${project.platforms.join(", ")}

Rédige le README public du mini-jeu en suivant EXACTEMENT cette structure :

${README_TEMPLATE.replace(/{titre}/g, project.title)}

RÈGLES IMPÉRATIVES :
- Écris pour un joueur curieux qui découvre le cours espion, PAS pour un développeur
- Évoque l'univers de l'Université d'Espions avec enthousiasme
- Zéro jargon technique : pas de stack, pas de framework, pas d'architecture
- Chaque phrase doit donner ENVIE de jouer et d'entrer dans ce cours espion
- Sois précis sur ce que le joueur VIT (sensations, tension, satisfaction d'espion)
- Le ton doit être passionné et direct, comme un brief de mission secrète
- Rends le markdown BRUT, sans bloc ${TRIPLE_BACKTICK}markdown, sans backticks d'encapsulation
- N'échappe jamais le document sous forme de chaîne avec des \n ou du JSON
- Langue : Français
- Ne réponds QUE avec le contenu du document, sans introduction ni commentaire`;
}

const DOC_PLACEHOLDER_MARKERS = [
  "> À remplir par le Game Designer.",
  "> À remplir par le Lead Dev.",
  "> À générer par le Producer.",
  "> À remplir.",
];

function isPlaceholderDocContent(content: string | null | undefined): boolean {
  const normalized = (content ?? "").trim();
  if (!normalized) return true;
  return DOC_PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function buildRepoSnapshotSection(files: RepoTextFileSnapshot[]): string {
  if (files.length === 0) {
    return "Aucun fichier exploitable n'a pu être extrait du dépôt.";
  }

  return files
    .map((file) => `### ${file.path}\n${TRIPLE_BACKTICK}\n${file.content}\n${TRIPLE_BACKTICK}`)
    .join("\n\n");
}

function buildSupportingDocsSection(docs: Record<string, string | null>): string {
  return Object.entries(docs)
    .filter(([, content]) => !!content)
    .map(([label, content]) => `### ${label}\n\n${content}`)
    .join("\n\n---\n\n");
}

function buildCompletedWorkSummary(tasks: PipelineTask[]): string {
  const completedTasks = tasks.filter((task) => task.status === "completed");
  if (completedTasks.length === 0) {
    return "Aucune tâche de développement précédente n'est enregistrée.";
  }

  return completedTasks
    .sort((left, right) => left.waveNumber - right.waveNumber || left.sortOrder - right.sortOrder)
    .map(
      (task) =>
        `- Wave ${task.waveNumber} | ${task.title}${task.backlogRef ? ` | ${task.backlogRef}` : ""}${task.deliverablePath ? ` | ${task.deliverablePath}` : ""}`
    )
    .join("\n");
}

function buildRepoGroundedPrompt(
  project: Project,
  role: string,
  template: string,
  repoFiles: RepoTextFileSnapshot[],
  supportingDocs: Record<string, string | null>,
  extraRules: string[] = []
): string {
  const supportingDocsSection = buildSupportingDocsSection(supportingDocs);

  return `Tu es ${role} dans un studio de jeu vidéo indépendant.
Tu dois reconstruire une documentation fidèle au dépôt GitHub EXISTANT du jeu "${project.title}".

Pitch produit : ${project.description}
Moteur : ${project.engine} | Plateformes : ${project.platforms.join(", ")} | Genre : ${project.genre}

Contexte auxiliaire déjà présent dans le repo :
${supportingDocsSection || "Aucun document auxiliaire exploitable."}

Extrait structurant du dépôt :
${buildRepoSnapshotSection(repoFiles)}

Rédige le document demandé en suivant EXACTEMENT cette structure :

${template.replace(/{titre}/g, project.title)}

RÈGLES IMPÉRATIVES :
- Base-toi d'abord sur le code réellement présent dans le dépôt
- Les systèmes absents peuvent être proposés comme prochaine étape, mais jamais décrits comme déjà implémentés
- Sois spécifique à CE jeu et à CET état du projet, aucun contenu générique
- Fais ressortir clairement la boucle "énergie éphémère -> réinvestissement -> automatisation"
- RESPECTE IMPÉRATIVEMENT les décisions du directeur listées ci-dessus
- RESPECTE IMPÉRATIVEMENT les garde-fous listés ci-dessus — ne les contourne JAMAIS
- Si tu dois décider d'un point NON couvert par les décisions du directeur, marque-le avec [DÉCISION IA] en début de ligne
${extraRules.map((rule) => `- ${rule}`).join("\n")}
- Format : Markdown brut, sans bloc ${TRIPLE_BACKTICK}markdown externe, sans JSON, sans commentaire autour
- Langue : Français
- Ne réponds QUE avec le contenu du document`;
}

async function generateRepoGroundedDocument(prompt: string): Promise<string> {
  const { content } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    LLM_PARAMS.tasks
  );

  return content.trim();
}

async function syncConceptTaskDeliverable(
  projectId: string,
  deliverablePath: string,
  content: string
): Promise<void> {
  const { updateTaskDeliverableContent } = await import("@/lib/services/pipelineService");
  const conceptTasks = await getTasksByProject(projectId, "concept");
  const matchingTask = conceptTasks.find((task) => task.deliverablePath === deliverablePath);
  if (!matchingTask) return;
  await updateTaskDeliverableContent(matchingTask.id, content);
}

// ============================================================
// Agent assignment
// ============================================================

function pickAgent(department: string, agents: Agent[], taskTitle?: string): Agent | null {
  const deptAgents = agents.filter(
    (a) => a.department === department && a.status === "active"
  );
  if (deptAgents.length === 0) return null;
  // Prefer non-system agents first (real team members)
  const candidates = deptAgents.filter((a) => !(a as Agent & { is_system_agent?: boolean }).is_system_agent);
  const pool = candidates.length > 0 ? candidates : deptAgents;

  // For programming department: match by specialization keywords if a task title is provided
  if (department === "programming" && taskTitle) {
    const titleLower = taskTitle.toLowerCase();
    const SPEC_KEYWORDS: Record<string, string[]> = {
      gameplay: ["gameplay", "mécanique", "contrôle", "physique", "jeu", "player", "level"],
      engine: ["moteur", "engine", "perf", "rendu", "shader", "optimis", "profil"],
      backend: ["backend", "api", "base de données", "serveur", "auth", "supabase", "rest"],
      "ui-tech": ["ui", "interface", "front", "design", "composant", "layout", "css"],
      devops: ["deploy", "build", "ci", "cd", "pipeline", "infra", "docker"],
    };

    for (const [specId, keywords] of Object.entries(SPEC_KEYWORDS)) {
      if (keywords.some((kw) => titleLower.includes(kw))) {
        const specMatch = pool.find((a) => (a as Agent & { specialization?: string }).specialization === specId);
        if (specMatch) return specMatch;
      }
    }
  }

  // Prefer leads, then confirmés, then juniors
  const byPosition = (a: Agent) => {
    const pos = (a as Agent & { position?: string }).position;
    if (pos === "lead") return 0;
    if (pos === "confirmé") return 1;
    return 2;
  };
  return pool.sort((a, b) => byPosition(a) - byPosition(b))[0];
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate the full concept pipeline for a project.
 * Creates 5 tasks (GDD → TechSpec → Backlog → CourseDesign → README).
 * The GDD task is pre-filled with the finalized GDD V2 from brainstorming.
 * All other tasks are generated sequentially, each audited against the GDD.
 */
export async function generateConceptPipeline(project: Project): Promise<PipelineTask[]> {
  // Check if tasks already exist for this project
  const existing = await getTasksByProject(project.id, "concept");
  if (existing.length > 0) {
    return existing;
  }

  // Fetch finalized GDD from brainstorming session
  const session = await getSessionByProject(project.id);
  if (!session?.gddFinalized || !session.gddV2) {
    throw new Error("Le GDD doit être finalisé via le brainstorming avant de générer les documents.");
  }
  const finalGdd = session.gddV2;

  const agents = await getAllAgents();

  const createdTasks: PipelineTask[] = [];

  for (const doc of CONCEPT_DOCS) {
    const assignedAgent = pickAgent(doc.agentDepartment, agents, doc.title);
    const dependsOn: string[] =
      createdTasks.length > 0 ? [createdTasks[createdTasks.length - 1].id] : [];
    const isGddTask = doc.sortOrder === 1;

    // GDD task: pre-filled with the finalized V2, no re-generation needed
    const status: PipelineTask["status"] = isGddTask ? "completed" : "created";

    const task = await createTask({
      projectId: project.id,
      title: doc.title,
      description: doc.description,
      backlogRef: null,
      projectPhase: "concept",
      waveNumber: 0,
      sortOrder: doc.sortOrder,
      status,
      requiresReview: isGddTask ? false : doc.requiresReview, // GDD already reviewed in wizard
      assignedAgentSlug: assignedAgent?.slug ?? null,
      agentDepartment: doc.agentDepartment,
      llmModel: LLM_MODELS.tasks,
      llmPromptTemplate: isGddTask
        ? null
        : doc.promptBuilder(project),
      llmContextFiles: [],
      deliverableType: "markdown",
      deliverablePath: doc.deliverablePath,
      deliverableContent: isGddTask ? finalGdd : null,
      dependsOn: isGddTask ? [] : dependsOn,
    });

    createdTasks.push(task);
  }

  // Advance pipeline: GDD is already completed → unlock TechSpec
  await advancePipeline(project.id);

  // Enrich TechSpec prompt with GDD content
  await enrichNextTaskPrompt(project.id, project);

  return createdTasks;
}

/**
 * Audit a generated document against the GDD.
 * If non-compliant, regenerates the document with the GDD as strict context.
 */
export async function auditDocumentAgainstGdd(
  project: Project,
  docTitle: string,
  docContent: string,
  gddContent: string,
  regeneratePrompt: string
): Promise<{ content: string; wasRegenerated: boolean; issues: unknown[] }> {
  const auditPrompt = buildAuditPrompt(docTitle, docContent, gddContent);

  const { content: auditJson } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: auditPrompt }],
    { temperature: 0.1, max_tokens: 800 }
  );

  let auditResult: { compliant: boolean; issues: unknown[]; summary: string } = {
    compliant: true,
    issues: [],
    summary: "",
  };

  try {
    const parsed = JSON.parse(auditJson.trim().replace(/```json\n?/g, "").replace(/```\n?/g, ""));
    auditResult = parsed;
  } catch {
    // If audit JSON fails to parse, assume compliant to avoid blocking
    return { content: docContent, wasRegenerated: false, issues: [] };
  }

  if (auditResult.compliant) {
    return { content: docContent, wasRegenerated: false, issues: [] };
  }

  // Non-compliant: regenerate with GDD as strict context
  const criticalIssues = (auditResult.issues as Array<{ severity: string; description: string }>)
    .filter((i) => i.severity === "critical")
    .map((i) => `- ${i.description}`)
    .join("\n");

  const fixPrompt = `${regeneratePrompt}

CORRECTIONS IMPÉRATIVES :
Les problèmes suivants ont été détectés par rapport au GDD. Corrige-les absolument :
${criticalIssues}

GDD de référence (à suivre à 110%) :
---
${gddContent}
---`;

  const { content: fixedRaw } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: fixPrompt }],
    { ...LLM_PARAMS.tasks, max_tokens: 4096 }
  );

  const fixedContent = normalizeMarkdownDeliverable(fixedRaw);
  return { content: fixedContent, wasRegenerated: true, issues: auditResult.issues };
}

/**
 * Execute a concept task: call DeepSeek with the task prompt and store the generated content.
 * For non-GDD docs: audits output against GDD and regenerates if non-compliant.
 */
export async function executeConceptTask(task: PipelineTask): Promise<{
  content: string;
  tokensUsed: number | null;
}> {
  if (!task.llmPromptTemplate) {
    throw new Error("Task has no prompt template");
  }

  const { content: rawContent, tokensUsed } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: task.llmPromptTemplate }],
    LLM_PARAMS.tasks
  );

  const content = normalizeMarkdownDeliverable(rawContent);

  // Audit non-GDD documents against the finalized GDD
  const isGddTask = task.deliverablePath === "docs/gdd.md";
  if (!isGddTask) {
    const session = await getSessionByProject(task.projectId);
    const gddContent = session?.gddV2 ?? null;

    if (gddContent) {
      const docDef = CONCEPT_DOCS.find((d) => d.deliverablePath === task.deliverablePath);
      if (docDef) {
        const { content: auditedContent } = await auditDocumentAgainstGdd(
          { id: task.projectId } as Project,
          task.title,
          content,
          gddContent,
          task.llmPromptTemplate
        );
        return { content: auditedContent, tokensUsed };
      }
    }
  }

  return { content, tokensUsed };
}

/**
 * After a task is approved, rebuild the prompt for the next task
 * injecting the content of all completed docs as context.
 */
export async function enrichNextTaskPrompt(
  projectId: string,
  project: Project
): Promise<void> {
  const allTasks = await getTasksByProject(projectId, "concept");
  const completed = allTasks.filter((t) => t.status === "completed" && t.deliverableContent);
  const nextTask = allTasks.find((t) => t.status === "ready" || t.status === "created");

  if (!nextTask || completed.length === 0) return;

  // Build context section from completed docs
  const contextSection = completed
    .map((t) => `### ${t.title} (${t.deliverablePath})\n\n${t.deliverableContent}`)
    .join("\n\n---\n\n");

  // Find the doc def to rebuild the prompt with enriched context
  const docDef = CONCEPT_DOCS.find((d) => d.deliverablePath === nextTask.deliverablePath);
  if (!docDef) return;

  const basePrompt = docDef.promptBuilder(project);
  const enrichedPrompt = `${basePrompt}\n\n---\n\n## Documents déjà validés (contexte)\n\n${contextSection}`;

  await updateTaskPrompt(nextTask.id, enrichedPrompt);

  // Unlock the next task (move created → ready), regardless of requiresReview
  await advancePipeline(projectId);
}

export async function regenerateProjectDocsFromRepo(
  projectId: string,
  project: Project
): Promise<{ gdd: string; techSpec: string; backlog: string }> {
  if (!project.githubRepoName) {
    throw new Error("Project has no GitHub repo");
  }

  const { getRepositorySnapshot, getFileContent, pushFile } = await import("@/lib/services/githubService");
  const existingDevTasks = await getTasksByProject(projectId, "in-dev");
  const repoFiles = await getRepositorySnapshot(project.githubRepoName, {
    maxFiles: 14,
    maxFileChars: 3500,
  });

  const [existingGdd, existingTechSpec, existingBacklog, dataArch, assetList, readme] = await Promise.all([
    getFileContent(project.githubRepoName, "docs/gdd.md"),
    getFileContent(project.githubRepoName, "docs/tech-spec.md"),
    getFileContent(project.githubRepoName, "docs/backlog.md"),
    getFileContent(project.githubRepoName, "docs/data-arch.md"),
    getFileContent(project.githubRepoName, "docs/asset-list.md"),
    getFileContent(project.githubRepoName, "README.md"),
  ]);

  if (
    !isPlaceholderDocContent(existingGdd) &&
    !isPlaceholderDocContent(existingTechSpec) &&
    !isPlaceholderDocContent(existingBacklog)
  ) {
    await Promise.all([
      syncConceptTaskDeliverable(projectId, "docs/gdd.md", existingGdd ?? ""),
      syncConceptTaskDeliverable(projectId, "docs/tech-spec.md", existingTechSpec ?? ""),
      syncConceptTaskDeliverable(projectId, "docs/backlog.md", existingBacklog ?? ""),
    ]);

    return {
      gdd: existingGdd ?? "",
      techSpec: existingTechSpec ?? "",
      backlog: existingBacklog ?? "",
    };
  }

  const supportingDocs = {
    "Architecture Data & État": dataArch,
    "Asset List": assetList,
    README: readme,
  };
  const completedWork = buildCompletedWorkSummary(existingDevTasks);

  const gddPrompt = buildRepoGroundedPrompt(
    project,
    "Game Designer senior",
    GDD_TEMPLATE,
    repoFiles,
    supportingDocs,
    [
      "Distingue l'existant, le MVP jouable visé à court terme et la projection moyen terme.",
      "Le GDD doit rester cohérent avec les foundations déjà présentes dans le dépôt.",
    ]
  );

  const techSpecPrompt = buildRepoGroundedPrompt(
    project,
    "Lead Developer senior",
    TECH_SPEC_TEMPLATE,
    repoFiles,
    supportingDocs,
    [
      "Décris l'architecture réellement visible dans le dépôt avant de proposer les extensions nécessaires.",
      "Mentionne explicitement les zones incomplètes, duplications ou incohérences techniques à corriger.",
    ]
  );

  const backlogPrompt = `${buildRepoGroundedPrompt(
    project,
    "Producer technique senior",
    BACKLOG_TEMPLATE,
    repoFiles,
    supportingDocs,
    [
      "Le backlog doit couvrir l'ensemble du projet, mais prendre en compte les foundations déjà réalisées.",
      "Le résumé des dépendances doit faire apparaître explicitement des waves 1 et 2 déjà réalisées, puis les waves futures pertinentes.",
      "Évite les tâches génériques de setup si elles sont déjà visibles dans le dépôt.",
    ]
  )}

Travail déjà réalisé dans Eden Studio :
${completedWork}`;

  const [gdd, techSpec, backlog] = await Promise.all([
    generateRepoGroundedDocument(gddPrompt),
    generateRepoGroundedDocument(techSpecPrompt),
    generateRepoGroundedDocument(backlogPrompt),
  ]);

  await Promise.all([
    pushFile(project.githubRepoName, "docs/gdd.md", gdd, "[eden] producer: regenerate gdd from repo state"),
    pushFile(project.githubRepoName, "docs/tech-spec.md", techSpec, "[eden] producer: regenerate tech spec from repo state"),
    pushFile(project.githubRepoName, "docs/backlog.md", backlog, "[eden] producer: regenerate backlog from repo state"),
  ]);

  await Promise.all([
    syncConceptTaskDeliverable(projectId, "docs/gdd.md", gdd),
    syncConceptTaskDeliverable(projectId, "docs/tech-spec.md", techSpec),
    syncConceptTaskDeliverable(projectId, "docs/backlog.md", backlog),
  ]);

  return { gdd, techSpec, backlog };
}

// ============================================================
// Phase 4 — Dev waves generation & execution
// ============================================================

interface DevTaskDef {
  title: string;
  description: string;
  backlog_ref: string;
  assigned_agent_slug: string | null;
  agent_department: string;
  deliverable_type?: string;
  deliverable_path: string;
  context_files: string[];
  depends_on_refs: string[]; // backlog_ref of tasks this task depends on
}

interface DevWaveDef {
  number: number;
  tasks: DevTaskDef[];
}

interface NextWaveTaskDef {
  title: string;
  description: string;
  backlog_ref: string;
  assigned_agent_slug: string | null;
  agent_department: string;
  deliverable_type?: string;
  deliverable_path: string;
  context_files: string[];
}

const VALID_DELIVERABLE_TYPES: DeliverableType[] = [
  "markdown",
  "code",
  "json",
  "config",
  "repo-init",
];

function inferDeliverableTypeFromPath(deliverablePath: string | null | undefined): DeliverableType {
  const normalizedPath = (deliverablePath ?? "").trim().toLowerCase();

  if (!normalizedPath) return "code";
  if (normalizedPath.endsWith(".md")) return "markdown";
  if (normalizedPath.endsWith(".json")) return "json";
  if (
    normalizedPath.endsWith(".yml") ||
    normalizedPath.endsWith(".yaml") ||
    normalizedPath.endsWith(".toml") ||
    normalizedPath.endsWith(".ini") ||
    normalizedPath.endsWith(".env") ||
    normalizedPath.includes("config")
  ) {
    return "config";
  }
  if (
    normalizedPath === ".gitignore" ||
    normalizedPath === "package.json" ||
    normalizedPath === "tsconfig.json" ||
    normalizedPath === "next.config.ts"
  ) {
    return "config";
  }

  return "code";
}

function normalizeDeliverableType(rawType: string | null | undefined, deliverablePath: string | null | undefined): DeliverableType {
  const normalizedType = rawType?.trim().toLowerCase();

  if (normalizedType) {
    if (VALID_DELIVERABLE_TYPES.includes(normalizedType as DeliverableType)) {
      return normalizedType as DeliverableType;
    }

    if (["md", "document", "doc", "docs", "spec"].includes(normalizedType)) {
      return "markdown";
    }
    if (["repo_init", "repoinit", "repo", "bootstrap"].includes(normalizedType)) {
      return "repo-init";
    }
  }

  const inferredType = inferDeliverableTypeFromPath(deliverablePath);
  console.warn(
    `[pipeline/generate] Invalid deliverable_type "${rawType ?? "undefined"}" for path "${deliverablePath ?? ""}". Falling back to "${inferredType}".`
  );
  return inferredType;
}

function buildNextWavePrompt(params: {
  project: Project;
  backlogContent: string;
  agents: Agent[];
  nextWaveNumber: number;
  repoFiles: RepoTextFileSnapshot[];
  completedWork: string;
  docs: { gdd: string | null; techSpec: string | null; dataArch: string | null };
}): string {
  const { project, backlogContent, agents, nextWaveNumber, repoFiles, completedWork, docs } = params;
  const agentsList = agents
    .filter((agent) => agent.status === "active")
    .map((agent) => `- ${agent.slug}: ${agent.name} (département: ${agent.department})`)
    .join("\n");

  const docsSection = [
    docs.gdd ? `## GDD\n\n${docs.gdd}` : null,
    docs.techSpec ? `## Tech Spec\n\n${docs.techSpec}` : null,
    docs.dataArch ? `## Data Arch\n\n${docs.dataArch}` : null,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const spyContext = buildSpyUniversityContext(project);

  return `Tu es un Producer technique senior.
Tu dois générer UNIQUEMENT la prochaine wave de développement pour le mini-jeu "${project.title}".

${spyContext}

Pitch : ${project.description}
Moteur : ${project.engine} | Plateformes : ${project.platforms.join(", ")} | Genre : ${project.genre}

Backlog actuel :
---
${backlogContent}
---

Documentation projet :
${docsSection || "Aucune documentation détaillée disponible."}

Travail déjà réalisé et terminé dans les waves précédentes :
${completedWork}

Extrait du dépôt courant :
${buildRepoSnapshotSection(repoFiles)}

Agents disponibles :
${agentsList}

Objectif : produire la wave ${nextWaveNumber} de rattrapage, strictement cohérente avec le backlog ET le code déjà présent.

RÈGLES :
- Génère entre 3 et 6 tâches maximum
- Les tâches de cette wave doivent être parallélisables entre elles
- Ne recrée pas les foundations déjà terminées
- Priorise le vrai core loop du jeu tel que défini dans le GDD et la Tech Spec
- Chaque tâche doit référencer un backlog_ref existant dans le backlog
- Assigne chaque tâche à l'agent le plus pertinent (slug exact ou null)
- deliverable_type doit être STRICTEMENT l'une de ces valeurs : "code", "markdown", "json", "config", "repo-init"
- deliverable_path doit pointer vers un fichier plausible du repo actuel
- context_files doit lister uniquement des fichiers existants et utiles
- INTERDIT : générer une tâche pour un système non mentionné dans la Tech Spec comme "à implémenter". Si un système est évoqué dans le GDD mais absent de la Tech Spec, ignore-le pour cette wave.

Réponds UNIQUEMENT en JSON strict, sans texte avant ni après :
{
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "backlog_ref": "CORE-001",
      "assigned_agent_slug": "slug-ou-null",
      "agent_department": "programming",
      "deliverable_type": "code",
      "deliverable_path": "src/systems/BuildingSystem.ts",
      "context_files": ["src/state/store.ts", "src/assets/buildings.json"]
    }
  ]
}`;
}

function buildDevWavesPrompt(project: Project, backlogContent: string, agents: Agent[]): string {
  const agentsList = agents
    .filter((a) => a.status === "active")
    .map((a) => `- ${a.slug}: ${a.name} (département: ${a.department})`)
    .join("\n");

  const spyContext = buildSpyUniversityContext(project);

  return `Tu es un Producer/Chef de projet technique dans un studio de jeu vidéo.

${spyContext}

Voici le Backlog complet du mini-jeu "${project.title}" :
---
${backlogContent}
---

Voici les agents développeurs disponibles :
${agentsList}

Analyse le backlog et génère des waves de développement PARALLÉLISABLES.

RÈGLES :
- Chaque wave contient des tâches qui peuvent s'exécuter en parallèle
- Une tâche de wave N+1 dépend de tâches de wave N
- Chaque tâche doit référencer son item backlog (ex: CORE-001)
- Assigne chaque tâche à l'agent le plus pertinent (utilise exactement le slug fourni, ou null)
- deliverable_type doit être STRICTEMENT l'une de ces valeurs : "code", "markdown", "json", "config", "repo-init"
- Chaque tâche doit spécifier le fichier de sortie (deliverable_path)
- depends_on_refs : liste des backlog_ref dont cette tâche dépend (ex: ["CORE-001", "SYS-002"]). Vide pour les tâches de wave 1.
- INTERDIT : générer une tâche pour un système non mentionné dans le backlog. Chaque tâche doit avoir un backlog_ref valide.
- INTERDIT : générer des tâches d'intégration (API externe, postMessage, VN, etc.) avant que le core gameplay soit dans le backlog et la tech-spec.

Réponds UNIQUEMENT en JSON strict, sans texte avant ni après :
{
  "waves": [
    {
      "number": 1,
      "tasks": [
        {
          "title": "...",
          "description": "Description technique précise",
          "backlog_ref": "CORE-001",
          "assigned_agent_slug": "slug-ou-null",
          "agent_department": "programming",
          "deliverable_type": "code",
          "deliverable_path": "src/systems/input.ts",
          "context_files": [],
          "depends_on_refs": []
        }
      ]
    }
  ]
}`;
}

function extractJson(raw: string): string {
  // Strip markdown code block if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Otherwise extract first {...} block
  const bare = raw.match(/(\{[\s\S]*\})/);
  if (bare) return bare[1].trim();
  return raw.trim();
}

async function callDevWavesLLM(prompt: string, temperature: number): Promise<DevWaveDef[]> {
  const { content } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    { ...LLM_PARAMS.tasks, temperature }
  );
  const parsed = JSON.parse(extractJson(content));
  if (!parsed.waves || !Array.isArray(parsed.waves)) {
    throw new Error("Invalid response: missing waves array");
  }
  return parsed.waves as DevWaveDef[];
}

async function callNextWaveLLM(prompt: string): Promise<NextWaveTaskDef[]> {
  const { content } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    { ...LLM_PARAMS.tasks, temperature: 0.15 }
  );
  const parsed = JSON.parse(extractJson(content));
  if (!Array.isArray(parsed.tasks)) {
    throw new Error("Invalid response: missing tasks array");
  }
  return parsed.tasks as NextWaveTaskDef[];
}

/**
 * Reads the approved backlog from GitHub, calls DeepSeek to decompose it into
 * parallelizable waves, and creates the in-dev pipeline tasks in the DB.
 * Idempotent: returns existing tasks if they already exist.
 */
export async function generateDevWaves(projectId: string, project: Project): Promise<PipelineTask[]> {
  const existing = await getTasksByProject(projectId, "in-dev");
  if (existing.length > 0) return existing;

  if (!project.githubRepoName) throw new Error("Project has no GitHub repo");

  const { getFileContent } = await import("@/lib/services/githubService");
  const backlogContent = await getFileContent(project.githubRepoName, "docs/backlog.md");
  if (!backlogContent) throw new Error("Backlog not found in GitHub repo");

  const agents = await getAllAgents();
  const prompt = buildDevWavesPrompt(project, backlogContent, agents);

  let waves: DevWaveDef[];
  try {
    waves = await callDevWavesLLM(prompt, 0.2);
  } catch {
    // Retry once with lower temperature
    waves = await callDevWavesLLM(prompt, 0.1);
  }

  // Flatten all tasks into a global ordered list for ref resolution
  const allDefs = waves.flatMap((w) => w.tasks.map((t) => ({ ...t, waveNumber: w.number })));
  const createdTasks: PipelineTask[] = [];
  // Map backlog_ref → task id, built as tasks are created
  const refToTaskId = new Map<string, string>();

  for (let i = 0; i < allDefs.length; i++) {
    const def = allDefs[i];

    // Resolve depends_on_refs via backlog_ref names (only tasks already created)
    const dependsOn: string[] = (def.depends_on_refs ?? [])
      .map((ref: string) => refToTaskId.get(ref))
      .filter(Boolean) as string[];

    // Wave 1 tasks with no explicit deps start as ready; everything else as created
    const status: PipelineTask["status"] =
      def.waveNumber === 1 && dependsOn.length === 0 ? "ready" : "created";

    // Validate agent slug exists
    const validSlug =
      def.assigned_agent_slug &&
      agents.find((a) => a.slug === def.assigned_agent_slug)
        ? def.assigned_agent_slug
        : null;

    const task = await createTask({
      projectId,
      title: def.title,
      description: def.description,
      backlogRef: def.backlog_ref ?? null,
      projectPhase: "in-dev",
      waveNumber: def.waveNumber,
      sortOrder: i,
      status,
      requiresReview: false,
      assignedAgentSlug: validSlug,
      agentDepartment: def.agent_department ?? "programming",
      llmModel: LLM_MODELS.tasks,
      llmPromptTemplate: null, // Built at execution time with live context
      llmContextFiles: def.context_files ?? [],
      deliverableType: normalizeDeliverableType(def.deliverable_type, def.deliverable_path),
      deliverablePath: def.deliverable_path ? def.deliverable_path.replace(/^\.\//, "").replace(/\/+$/, "") : null,
      deliverableContent: null,
      dependsOn,
    });

    createdTasks.push(task);
    if (def.backlog_ref) refToTaskId.set(def.backlog_ref, task.id);
  }

  return createdTasks;
}

export async function generateNextDevWave(projectId: string, project: Project): Promise<PipelineTask[]> {
  const existing = await getTasksByProject(projectId, "in-dev");
  if (existing.length === 0) {
    return generateDevWaves(projectId, project);
  }

  const unfinishedTasks = existing.filter((task) => task.status !== "completed");
  if (unfinishedTasks.length > 0) {
    throw new Error("Toutes les tâches en cours doivent être terminées avant de générer une nouvelle wave.");
  }

  if (!project.githubRepoName) {
    throw new Error("Project has no GitHub repo");
  }

  const { getFileContent, getRepositorySnapshot } = await import("@/lib/services/githubService");
  const [backlogContent, gdd, techSpec, dataArch] = await Promise.all([
    getFileContent(project.githubRepoName, "docs/backlog.md"),
    getFileContent(project.githubRepoName, "docs/gdd.md"),
    getFileContent(project.githubRepoName, "docs/tech-spec.md"),
    getFileContent(project.githubRepoName, "docs/data-arch.md"),
  ]);

  if (!backlogContent) {
    throw new Error("Backlog not found in GitHub repo");
  }

  const agents = await getAllAgents();
  const nextWaveNumber = Math.max(...existing.map((task) => task.waveNumber), 0) + 1;
  const repoFiles = await getRepositorySnapshot(project.githubRepoName, {
    maxFiles: 14,
    maxFileChars: 3500,
  });
  const prompt = buildNextWavePrompt({
    project,
    backlogContent,
    agents,
    nextWaveNumber,
    repoFiles,
    completedWork: buildCompletedWorkSummary(existing),
    docs: { gdd, techSpec, dataArch },
  });
  const defs = await callNextWaveLLM(prompt);

  const createdTasks: PipelineTask[] = [];
  const baseSortOrder = existing.length;

  for (let index = 0; index < defs.length; index++) {
    const def = defs[index];
    const validSlug =
      def.assigned_agent_slug && agents.find((agent) => agent.slug === def.assigned_agent_slug)
        ? def.assigned_agent_slug
        : null;

    const normalizedContextFiles = Array.from(
      new Set((def.context_files ?? []).map((path) => path.replace(/^\.\//, "").replace(/\/+$/, "")))
    );

    const task = await createTask({
      projectId,
      title: def.title,
      description: def.description,
      backlogRef: def.backlog_ref ?? null,
      projectPhase: "in-dev",
      waveNumber: nextWaveNumber,
      sortOrder: baseSortOrder + index,
      status: "ready",
      requiresReview: false,
      assignedAgentSlug: validSlug,
      agentDepartment: def.agent_department ?? "programming",
      llmModel: LLM_MODELS.tasks,
      llmPromptTemplate: null,
      llmContextFiles: normalizedContextFiles,
      deliverableType: normalizeDeliverableType(def.deliverable_type, def.deliverable_path),
      deliverablePath: def.deliverable_path ? def.deliverable_path.replace(/^\.\//, "").replace(/\/+$/, "") : null,
      deliverableContent: null,
      dependsOn: [],
    });

    createdTasks.push(task);
  }

  return createdTasks;
}

function buildDevTaskPrompt(
  project: Project,
  task: PipelineTask,
  docs: { gdd: string | null; techSpec: string | null; dataArch: string | null },
  contextFiles: { path: string; content: string }[]
): string {
  const docsSection = [
    docs.gdd && `## Game Design Document\n\n${docs.gdd}`,
    docs.techSpec && `## Spécification Technique\n\n${docs.techSpec}`,
    docs.dataArch && `## Architecture Data & État\n\n${docs.dataArch}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const contextSection =
    contextFiles.length > 0
      ? `## Fichiers existants (contexte)\n\n${contextFiles
          .map((f) => `### ${f.path}\n${'```'}\n${f.content}\n${'```'}`)
          .join("\n\n")}`
      : "";

  const backlogLine = task.backlogRef ? `\nItem backlog : ${task.backlogRef}` : "";

  const spyContext = buildSpyUniversityContext(project);

  return `Tu es un développeur web expert dans un studio de jeu vidéo indépendant.

${spyContext}

Mini-jeu : "${project.title}" — ${project.description}
Moteur : ${project.engine} | Plateformes : ${project.platforms.join(", ")} | Genre : ${project.genre}${backlogLine}

Tâche : ${task.title}
Description : ${task.description}
Fichier de sortie : ${task.deliverablePath ?? "non spécifié"}

${docsSection ? `---\n\n${docsSection}\n\n---\n\n` : ""}${contextSection ? `${contextSection}\n\n---\n\n` : ""}RÈGLES :
- Génère UNIQUEMENT le contenu du fichier ${task.deliverablePath ?? "demandé"}, sans explication ni commentaire externe
- Code fonctionnel et idiomatique, conforme à la stack définie dans la Tech Spec
- Respecte les patterns architecturaux définis dans la Data Arch
- Commentaires de code en français
- Ne génère pas de TODO ou de placeholder`;
}

/**
 * Execute a dev (in-dev phase) task: injects GDD + TechSpec + DataArch + dependency
 * file contents as context, then calls DeepSeek to generate the code/file content.
 */
export async function executeDevTask(
  task: PipelineTask,
  project: Project
): Promise<{ content: string; tokensUsed: number | null }> {
  if (!project.githubRepoName) throw new Error("Project has no GitHub repo");

  const { getFileContent } = await import("@/lib/services/githubService");
  const { getTaskById } = await import("@/lib/services/pipelineService");
  const repoName = project.githubRepoName;

  // Read the three base docs in parallel
  const [gdd, techSpec, dataArch] = await Promise.all([
    getFileContent(repoName, "docs/gdd.md"),
    getFileContent(repoName, "docs/tech-spec.md"),
    getFileContent(repoName, "docs/data-arch.md"),
  ]);

  // Collect context from completed dependency tasks
  const seenPaths = new Set<string>();
  const contextFiles: { path: string; content: string }[] = [];

  for (const depId of task.dependsOn) {
    const depTask = await getTaskById(depId);
    if (!depTask?.deliverablePath) continue;
    if (seenPaths.has(depTask.deliverablePath)) continue;
    seenPaths.add(depTask.deliverablePath);

    const fileContent =
      depTask.deliverableContent ??
      (await getFileContent(repoName, depTask.deliverablePath));
    if (fileContent) {
      contextFiles.push({ path: depTask.deliverablePath, content: fileContent });
    }
  }

  // Also pull any explicitly listed context files that aren't already included
  for (const filePath of task.llmContextFiles) {
    if (seenPaths.has(filePath)) continue;
    seenPaths.add(filePath);
    const fileContent = await getFileContent(repoName, filePath);
    if (fileContent) {
      contextFiles.push({ path: filePath, content: fileContent });
    }
  }

  const prompt = buildDevTaskPrompt(project, task, { gdd, techSpec, dataArch }, contextFiles);

  const { content, tokensUsed } = await callOpenRouter(
    LLM_MODELS.tasks,
    [{ role: "user", content: prompt }],
    LLM_PARAMS.tasks
  );

  return { content, tokensUsed };
}
