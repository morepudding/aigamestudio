
# Plan de refonte pipeline — ordre d'implémentation recommandé

Suite à l'audit critique du workflow complet (brainstorming → concept → in-dev → post-mortem),
voici les corrections classées par priorité réelle, pas par facilité.

---

## Philosophie générale

Le pipeline souffre de trois maux fondamentaux :

1. **Les feedback loops sont brisés** — on peut rejeter, noter, critiquer... et rien ne change
2. **La résilience est inexistante** — un timeout et tout le travail de l'agent s'évapore
3. **Les agents simulent la collaboration** — ils exécutent, ils ne raisonnent pas

L'ordre ci-dessous priorise d'abord ce qui casse silencieusement (perte de données, divergence DB/GitHub),
ensuite ce qui trompe l'utilisateur (feedback ignoré), enfin ce qui plafonne la valeur (agents passifs).

---

## Lot 1 — Résilience : ne plus perdre le travail

> Ces bugs n'ont pas de UI. On ne les voit pas jusqu'au jour où l'agent plante à l'itération 18.

### 1.1 — Streaming des writes GitHub pendant l'agentic loop

**Problème** : tous les fichiers écrits par l'agent sont bufferisés en RAM et committés d'un bloc à la fin.
Un timeout, un crash réseau, une erreur OpenRouter à l'itération 19 → tout est perdu, silencieusement.

**Fix** : committer au fil de l'eau, par checkpoint (toutes les N itérations ou sur `task_complete`).
Les commits intermédiaires peuvent être sur une branche feature, mergée sur `main` à la complétion.

**Fichiers concernés** : `lib/services/codingAgentService.ts`, `lib/services/githubService.ts`

---

### 1.2 — Retry + gestion rate-limit GitHub

**Problème** : zéro retry sur les appels Octokit. Un 429 ou 503 GitHub = tâche marquée failed sans récupération.

**Fix** : wrapper `githubService` avec exponential backoff (3 tentatives, délais 1s/2s/4s).
Distinguer les erreurs récupérables (rate-limit, timeout) des erreurs permanentes (404, auth).

**Fichiers concernés** : `lib/services/githubService.ts`

---

### 1.3 — Transactions DB ↔ GitHub

**Problème** : si le push GitHub réussit mais la mise à jour DB échoue (ou l'inverse), les deux systèmes divergent.
Il n'existe aucun mécanisme de reconciliation.

**Fix** : pattern "outbox" — écrire d'abord en DB l'état `pending_github_push`, puis pusher, puis confirmer.
Si la confirmation échoue, un job de reconciliation peut retrouver les tâches `pending_github_push` > 5min.

**Fichiers concernés** : `app/api/pipeline/task/[taskId]/execute/route.ts`, nouveau job de reconciliation

---

## Lot 2 — Feedback loops : rendre les décisions du directeur réelles

> Le directeur passe du temps à rejeter des waves et noter des agents. Ce temps doit compter.

### 2.1 — Wave rejection qui bloque vraiment ✅

**Fix appliqué** :
- `advancePipeline` vérifie maintenant que la wave review N-1 est `approved` avant de débloquer des tâches de la wave N. Sans approbation, les tâches restent `created`.
- `rejectWaveReview` injecte le `rejectionPrompt` dans le `llm_prompt_template` de toutes les tâches de la wave rejetée, pour que la regénération en tienne compte.

**Fichiers modifiés** : `lib/services/pipelineService.ts`, `lib/services/waveReviewService.ts`

---

### 2.2 — Regénération de wave sur rejet

**Problème** : il n'existe pas de flow "corriger cette wave". Le rejet est stocké mais rien ne s'exécute.

**Fix** : sur rejet, proposer deux options au directeur :
- **Corriger** : marque les tâches de la wave comme `needs-revision`, réinjecte le feedback, réexécute
- **Passer** : override explicite, log la raison, débloque la wave suivante

**Fichiers concernés** : `components/pipeline/WaveReviewPanel.tsx`, nouveau endpoint `/revise`

---

### 2.3 — Skill prompts cross-project ✅ (déjà implémenté)

**Analyse** : le `project_id` sur `agent_skill_prompts` ne sert qu'à la traçabilité de l'origine (quel post-mortem).
`getActiveSkillPrompt` ne filtre PAS par projet — il y a **un seul prompt actif global** par agent à la fois (enforced par trigger DB).

De plus, Eve reçoit déjà le `previousPrompt` en contexte lors de la génération (`buildEveSkillPromptUser`) et est instruite de consolider : conserver ce qui est valide, remplacer ce que les nouvelles reviews contredisent. L'accumulation cross-project est donc native.

**Aucune modification nécessaire.**

---

### 2.4 — Traçabilité reviews → skill prompt

**Problème** : aucun lien entre les reviews qui ont généré un skill prompt et le prompt lui-même.
Impossible de savoir si le prompt est toujours pertinent ou basé sur des tâches d'un projet atypique.

**Fix** : stocker les IDs de task_reviews ayant contribué à chaque skill prompt version.
Afficher dans le post-mortem : "ce prompt v3 est basé sur 7 reviews du projet X".

**Fichiers concernés** : `lib/services/taskReviewService.ts`, `lib/services/agentSkillPromptService.ts`

---

## Lot 3 — Pipeline structure : flexibilité et cohérence

> Ces problèmes ne cassent pas immédiatement mais plafonnent ce que le pipeline peut faire.

### 3.1 — Génération incrémentale des waves

**Problème** : toutes les waves in-dev sont générées d'un bloc depuis le backlog au départ.
Si le scope pivote ou si une wave révèle des besoins non anticipés, les waves futures sont obsolètes.

**Fix** : générer seulement les 2 prochaines waves à l'avance. Après approbation de la wave N,
regénérer la wave N+2 avec le contexte des fichiers réellement écrits jusqu'ici (pas juste le backlog initial).

**Fichiers concernés** : `lib/services/producerService.ts`, `app/api/pipeline/[projectId]/generate/`

---

### 3.2 — Détection de cycles dans les dépendances

**Problème** : `dependsOn: string[]` n'est jamais validé pour les cycles. Une dépendance circulaire
créerait un deadlock silencieux où des tâches attendent indéfiniment.

**Fix** : validation DAG (Directed Acyclic Graph) lors de la création des tâches.
Algorithme DFS topologique, < 50 lignes. Bloquer la génération si cycle détecté.

**Fichiers concernés** : `lib/services/producerService.ts`

---

### 3.3 — Audit concept docs : critères explicites

**Problème** : l'audit "est-ce que ce doc est aligné avec le GDD" est une passe LLM sans critères définis.
Un doc peut passer l'audit et être vide de sens. Le directeur approuve sans grille d'évaluation.

**Fix** : définir une checklist par type de document (GDD, Tech Spec, Backlog) — ex: "le backlog contient
au moins 5 user stories par feature listée dans le GDD". L'audit LLM répond item par item, pas globalement.

**Fichiers concernés** : `lib/services/producerService.ts`, `lib/prompts/`

---

## Lot 4 — Agents : de l'exécution à la collaboration

> Le plus ambitieux. À faire en dernier parce que les fondations (lots 1-3) doivent être solides d'abord.

### 4.1 — Agents qui signalent les incohérences

**Problème** : un agent ne dit jamais "ce spec est contradictoire" ou "cette tâche dépend d'un fichier qui n'existe pas".
Il exécute aveuglément et produit un résultat potentiellement faux.

**Fix** : ajouter une phase de "pré-exécution" où l'agent lit ses dépendances et peut émettre une alerte.
Statut `blocked-by-issue` avec message structuré. Le directeur peut forcer ou corriger.

---

### 4.2 — Désaccords inter-agents dans le brainstorming

**Problème** : le brainstorming est séquentiel et docile. Chaque agent répond dans son coin.
Aucune tension, aucun vrai débat scope/faisabilité.

**Fix** : après la phase synthesis, ajouter une phase `debate` où 2 agents aux profils opposés
(ex: programmeur pragmatique vs game designer ambitieux) échangent sur les points de tension du GDD.
Le directeur arbitre. Le résultat conditionne le scope final.

---

### 4.3 — Mesure de l'impact des skill prompts

**Problème** : aucune mesure que les skill prompts améliorent quoi que ce soit.
On génère des règles dans le vide.

**Fix** : après chaque projet, comparer les ratings moyens des tâches exécutées avec vs sans skill prompt actif.
Dashboard simple dans le post-mortem : "avec le prompt v2, les tâches de code ont eu 4.1/5 en moyenne vs 3.2 avant".

---

## Vue d'ensemble — effort vs impact

```
                          IMPACT FORT
                               │
         ┌─────────────────────┼─────────────────────────┐
         │                     │                         │
         │  1.1 Streaming      │  2.1 Wave rejection     │
         │  GitHub writes      │  bloquant               │
         │                     │                         │
         │  1.3 Transactions   │  3.1 Waves              │
         │  DB ↔ GitHub        │  incrémentales          │
         │                     │                         │
  EFFORT ─────────────────────┼──────────────────────── EFFORT
  FORT                        │                         FAIBLE
         │                     │                         │
         │  4.2 Débats         │  1.2 Retry GitHub       │
         │  inter-agents       │                         │
         │                     │  3.2 Cycle detection    │
         │  4.3 Mesure         │                         │
         │  skill prompts      │  2.4 Traçabilité        │
         │                     │  reviews                │
         └─────────────────────┼─────────────────────────┘
                               │
                          IMPACT FAIBLE
```

---

## Ordre d'implémentation recommandé

```
Sprint 1 (fondations)
  ├── 1.2 Retry GitHub           ← 2h, zéro risque, gain immédiat
  ├── 3.2 Détection cycles DAG   ← 3h, prévient un bug silencieux
  └── 2.1 Wave rejection bloquant ← 4h, rend le feedback réel

Sprint 2 (résilience données)
  ├── 1.1 Streaming writes GitHub ← 1 jour, le plus important techniquement
  └── 1.3 Transactions DB/GitHub  ← 1 jour, complexe mais indispensable

Sprint 3 (pipeline intelligent)
  ├── 2.2 Regénération sur rejet  ← 0.5 jour, dépend de 2.1
  ├── 3.1 Waves incrémentales     ← 1 jour
  └── 3.3 Audit avec critères     ← 0.5 jour

Sprint 4 (capitalisation)
  ├── 2.3 Skill prompts cross-project ← 0.5 jour
  ├── 2.4 Traçabilité reviews         ← 0.5 jour
  └── 4.1 Agents signalent incohérences ← 1 jour

Sprint 5 (ambition)
  ├── 4.2 Débats inter-agents    ← 2 jours, refonte brainstorming
  └── 4.3 Mesure skill prompts   ← 1 jour
```

---

*Document généré suite à l'audit critique du pipeline complet — avril 2026*
