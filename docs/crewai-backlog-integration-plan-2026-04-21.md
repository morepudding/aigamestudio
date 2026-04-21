# Plan d'Integration CrewAI - Generation des Taches de Backlog

## Objectif

Ce document formalise le plan valide pour introduire CrewAI dans la pipeline de creation de jeu sans casser l'architecture actuelle.

L'objectif n'est pas de remplacer le moteur de pipeline existant.

L'objectif est de deleguer a CrewAI la proposition de taches et de waves a partir du backlog, puis de laisser l'application actuelle rester la source de verite pour :

- la persistence des taches
- les statuts
- les dependances
- l'assignation
- l'execution
- la review

---

## Positionnement Produit

CrewAI ne devient pas "le pipeline".

CrewAI devient une couche de planification assistee qui produit une proposition exploitable par le pipeline actuel.

Le flux cible est le suivant :

1. Le backlog approuve est lu depuis le repo et les documents projet.
2. L'application construit un snapshot de contexte projet.
3. Ce snapshot est envoye a un orchestrateur CrewAI externe.
4. CrewAI renvoie un JSON strict contenant les waves et les taches proposees.
5. L'application valide ce JSON.
6. L'application cree les `pipeline_tasks` avec les services existants.

En clair : CrewAI propose, l'application decide et persiste.

---

## Pourquoi cette approche

Le systeme actuel a deja de bonnes fondations :

- [lib/services/pipelineService.ts](lib/services/pipelineService.ts) gere la source de verite des taches
- [lib/services/producerService.ts](lib/services/producerService.ts#L1057) genere deja les waves
- [lib/services/codingAgentService.ts](lib/services/codingAgentService.ts) gere l'execution agentique des taches de code
- [components/pipeline/DevPipelineView.tsx](components/pipeline/DevPipelineView.tsx) expose deja une interface pipeline tres exploitable

La bonne strategie n'est donc pas de tout refaire.

La bonne strategie est de remplacer seulement la partie la plus fragile aujourd'hui : la decomposition backlog -> waves -> taches via un unique gros prompt.

---

## Scope du premier POC

Le premier POC couvre uniquement :

- la generation des waves de developpement
- la generation des taches de backlog associees
- la justification de planification visible dans l'UI

Le premier POC ne couvre pas :

- l'execution du code par CrewAI
- la review de code par CrewAI
- la memoire CrewAI comme source de verite
- le checkpointing CrewAI comme mecanisme principal de reprise

---

## Architecture Cible

## Systeme de record

L'application Next/Supabase/GitHub reste le systeme de record.

Responsabilites conservees dans l'app actuelle :

- lecture du backlog
- lecture du GDD et des specs
- creation des `pipeline_tasks`
- `advancePipeline`
- assignation d'agents
- execution et review

## Orchestrateur externe

CrewAI vit dans un microservice Python separe, par exemple :

- `crew-orchestrator/`

Ce service expose au debut un seul endpoint :

- `POST /plan-backlog`

Ce service ne modifie jamais directement Supabase ou GitHub.

Il ne fait que transformer un snapshot projet en proposition de planification.

---

## Contrat d'Entree

Le backend Next doit envoyer a CrewAI un payload structure de ce type :

```json
{
  "project": {
    "id": "jump-spy-2",
    "title": "...",
    "description": "...",
    "genre": "...",
    "engine": "...",
    "platforms": ["web"],
    "courseInfo": {
      "courseName": "...",
      "vnModule": "...",
      "mechanics": ["..."],
      "webEngine": "phaser"
    }
  },
  "documents": {
    "backlogMarkdown": "...",
    "gdd": "...",
    "techSpec": "...",
    "dataArch": "..."
  },
  "agents": [
    {
      "slug": "karim",
      "name": "Karim",
      "department": "programming",
      "specialization": "gameplay"
    }
  ],
  "constraints": {
    "maxTasksPerWave": 5,
    "preferSmallSlices": true,
    "mustProduceRepoPaths": true
  }
}
```

---

## Contrat de Sortie

La sortie doit etre strictement structuree et directement exploitable par [lib/services/producerService.ts](lib/services/producerService.ts#L1057).

Format cible :

```json
{
  "planningSummary": "...",
  "warnings": ["..."],
  "waves": [
    {
      "number": 1,
      "goal": "Prototype jouable du core loop",
      "tasks": [
        {
          "title": "Implementer la boucle d infiltration de base",
          "description": "...",
          "backlog_ref": "BG-01",
          "agent_department": "programming",
          "specialization": "gameplay",
          "deliverable_type": "code",
          "deliverable_path": "src/game/core-loop.ts",
          "context_files": [
            "docs/gdd.md",
            "docs/tech-spec.md"
          ],
          "depends_on_refs": [],
          "planning_notes": "Decoupee petite pour etre testable seule"
        }
      ]
    }
  ]
}
```

Champs obligatoires par tache :

- `title`
- `description`
- `backlog_ref`
- `agent_department`
- `deliverable_type`
- `deliverable_path`
- `context_files`
- `depends_on_refs`

Champs fortement recommandes :

- `specialization`
- `planning_notes`

---

## Design CrewAI

## Crew minimal

Le premier crew doit rester tres simple.

Trois roles suffisent :

1. `producer`
   Mission : decouper le backlog en waves livrables et petites slices.

2. `lead-dev`
   Mission : verifier la faisabilite, les dependances et les `context_files` utiles.

3. `qa-planner`
   Mission : detecter les taches floues, trop grosses ou impossibles a reviewer.

## Process

Pour le premier POC, utiliser un process `sequential` plutot que `hierarchical`.

Raison :

- plus simple a debugger
- plus lisible dans les logs
- plus stable pour comparer avec le systeme actuel

Le mode `hierarchical` pourra venir plus tard si un manager apporte un vrai gain.

## Flow

Le crew doit etre encapsule dans un `Flow` CrewAI avec etat structure.

Etapes recommandees :

1. `collect_inputs`
   Charge le snapshot projet.

2. `plan_tasks`
   Lance le crew de planification.

3. `validate_shape`
   Verifie que toutes les taches ont les champs minimaux.

4. `route_result`
   Route vers :
   - `ok`
   - `needs_human_input`
   - `invalid_output`

5. `normalize_output`
   Rend le JSON compatible avec le backend Next.

---

## Integration Backend

## Point d'entree a modifier

Le point d'integration principal est [lib/services/producerService.ts](lib/services/producerService.ts#L1057).

Aujourd'hui, `generateDevWaves` :

1. lit le backlog
2. appelle un LLM local via `callDevWavesLLM`
3. transforme la sortie en `pipeline_tasks`

Demain, `generateDevWaves` devra :

1. lire le backlog et les docs existantes
2. construire un `PlanningContext`
3. appeler `backlogPlanningService.planWithCrewAI(context)`
4. si succes, transformer la sortie en `pipeline_tasks`
5. si echec, fallback sur la logique actuelle

## Nouveau service conseille

Ajouter un service cote app :

- `lib/services/backlogPlanningService.ts`

Responsabilites :

- construire le payload d'entree
- appeler le microservice CrewAI
- parser la reponse
- valider le schema
- renvoyer une structure normalisee

---

## Fallback et Securite

Le fallback est obligatoire.

Cas de fallback :

- timeout du microservice
- JSON invalide
- taches sans `deliverable_path`
- dependances cycliques ou refs inconnues
- sortie vide

Comportement voulu :

1. log de l'erreur d'orchestration
2. bascule automatique vers la generation actuelle
3. marquage du run comme `fallback_used`

Cela permet d'introduire CrewAI sans rendre le pipeline indisponible.

---

## Observabilite

Il faut tracer chaque run de planification.

Je recommande une table ou structure equivalente :

- `pipeline_planning_runs`

Champs minimum :

- `id`
- `project_id`
- `provider`
- `status`
- `input_hash`
- `raw_output`
- `normalized_output`
- `warnings_json`
- `duration_ms`
- `token_usage`
- `fallback_used`
- `created_at`

Sans cette couche, il sera impossible de prouver que CrewAI est meilleur que la generation actuelle.

---

## Evaluation

Le POC doit etre juge sur des metriques simples et comparables.

Metriques conseillees :

- nombre de taches corrigees a la main apres generation
- taux de retry par tache
- taux de rejet ou de rework en review
- nombre de taches trop grosses pour une wave
- nombre de dependances manquantes detectees apres coup

Objectif du POC :

- moins de taches floues
- moins de placeholders
- des waves plus petites et plus livrables

---

## Comment on le voit cote UI

Le flow CrewAI doit etre visible comme une couche de planification au-dessus du pipeline, pas comme un systeme cache.

L'UI actuelle donne deja les bons points d'ancrage :

- [components/pipeline/PipelineView.tsx](components/pipeline/PipelineView.tsx)
- [components/pipeline/DevPipelineView.tsx](components/pipeline/DevPipelineView.tsx)
- [components/pipeline/WaveGroup.tsx](components/pipeline/WaveGroup.tsx)
- [components/pipeline/TaskCard.tsx](components/pipeline/TaskCard.tsx)
- [app/projects/[id]/page.tsx](app/projects/%5Bid%5D/page.tsx)

## Niveau 1. Etat de generation global

Quand le backlog est en train d'etre transforme en taches, on ajoute un bandeau ou bloc en tete de pipeline :

- statut : `Planification IA en cours`
- source : `CrewAI`
- etapes visibles : `Analyse backlog`, `Decoupage waves`, `Validation des dependances`, `Normalisation`

Visuellement, ce bloc peut vivre juste au-dessus de la barre de progression dans [components/pipeline/DevPipelineView.tsx](components/pipeline/DevPipelineView.tsx).

Le but n'est pas de montrer chaque pensee de l'agent.

Le but est de donner une lecture produit simple :

- ce que l'IA est en train de faire
- ou elle en est
- si elle a besoin d'un arbitrage humain

## Niveau 2. Resume de planification par wave

Chaque wave devrait pouvoir afficher une carte supplementaire compacte :

- objectif de la wave
- pourquoi ces taches sont ensemble
- risques identifies
- warning si la wave a ete creee avec fallback

Cette information peut s'afficher dans l'en-tete de [components/pipeline/WaveGroup.tsx](components/pipeline/WaveGroup.tsx), par exemple sous le titre `Wave N`.

## Niveau 3. Provenance et justification par tache

Chaque tache generee par CrewAI doit avoir une provenance lisible dans [components/pipeline/TaskCard.tsx](components/pipeline/TaskCard.tsx) :

- badge `Proposee par CrewAI`
- note courte `Pourquoi cette tache existe`
- `context_files` visibles en tooltip ou panneau detail
- eventuellement `backlog_ref` plus visible

Il ne faut pas afficher un roman.

Il faut afficher une justification courte et actionnable.

Exemples :

- `Decoupee pour isoler le core loop`
- `Necessaire avant l'integration VN`
- `Bloque la persistence de score`

## Niveau 4. Etat d'arbitrage humain

Si CrewAI renvoie `needs_human_input`, l'UI doit le rendre visible avant creation des taches.

Le pattern recommande est un panneau de validation :

- probleme detecte
- question posee a l'utilisateur
- 2 ou 3 choix proposes
- bouton `Regenerer avec cette decision`

Produit attendu : l'utilisateur doit sentir que l'IA propose un plan, pas qu'elle impose une structure opaque.

## Niveau 5. Trace de run consultable

Il faut un detail consultable depuis le projet :

- date du run
- provider
- duree
- warning
- fallback oui/non
- version du plan genere

Ca peut prendre la forme d'un tiroir ou d'un modal depuis l'ecran projet dans [app/projects/[id]/page.tsx](app/projects/%5Bid%5D/page.tsx).

Le besoin produit est simple : comprendre pourquoi cette pipeline ressemble a ca.

---

## Proposition UX concrete

Le rendu le plus utile a court terme serait :

1. Sur l'ecran projet, un bloc `Planification IA` au-dessus du pipeline.
2. Dans la wave, une ligne `objectif + warning + source`.
3. Dans la carte de tache, un mini badge `CrewAI` et une justification courte.
4. Un bouton `Regenerer la planification` ou `Regenerer la wave` reserve au manager humain.

Exemple de lecture utilisateur :

1. `CrewAI a planifie 4 waves`
2. `Wave 1 = prototype du core gameplay`
3. `Cette tache existe pour debloquer l'integration VN`
4. `Attention : une dependance a ete corrigee automatiquement`

Ca rend le flow visible sans noyer l'ecran.

---

## Roadmap d'Implementation

## Phase 1. Cadrage et contrats

1. Definir le schema JSON entree/sortie.
2. Ajouter `backlogPlanningService` dans l'app.
3. Ajouter la persistence des planning runs.

## Phase 2. Orchestrateur CrewAI minimal

1. Creer le microservice Python.
2. Ajouter le Flow et le Crew minimal.
3. Exposer `POST /plan-backlog`.
4. Retourner un JSON strict.

## Phase 3. Branchement backend

1. Modifier [lib/services/producerService.ts](lib/services/producerService.ts#L1057).
2. Ajouter le feature flag `USE_CREWAI_BACKLOG_PLANNER`.
3. Activer le fallback automatique.

## Phase 4. UI minimale

1. Ajouter le bloc `Planification IA` dans [components/pipeline/DevPipelineView.tsx](components/pipeline/DevPipelineView.tsx).
2. Ajouter les metadata de wave.
3. Ajouter provenance et justification sur les taches.

## Phase 5. Evaluation

1. Comparer quelques projets generes avec et sans CrewAI.
2. Mesurer les reworks.
3. Decider si on etend CrewAI a la review de wave.

---

## Decision Produit Recommandee

La meilleure implementation n'est pas :

- CrewAI partout

La meilleure implementation est :

- CrewAI visible la ou il planifie
- backend actuel visible la ou il execute
- responsabilites explicites

Autrement dit :

CrewAI doit etre percu comme un directeur de production adjoint qui prepare le plan.

Le pipeline existant reste l'atelier qui fabrique, valide et sort le jeu.