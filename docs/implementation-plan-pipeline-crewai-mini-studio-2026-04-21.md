# Plan d'implementation - Refonte pipeline CrewAI et mini-studio

Date: 2026-04-21

## Objectif

Refondre la pipeline projet autour de quatre principes simples:

1. Le brainstorming lui-meme doit etre absorbe par CrewAI plutot que rester une suite d'ecrans et d'etapes semi-manuelles.
2. Tout le travail documentaire doit etre absorbe par CrewAI.
3. La pipeline de developpement doit cesser de simuler un gros studio generique et suivre un modele de mini-studio adapte a des jeux web simples de type Pong, Tetris, mini platformer ou infiltration legere.
4. Le studio doit constituer une bibliotheque de vrais exemples et de prototypes jouables pour que les agents de dev s'inspirent d'artefacts concrets, pas seulement de prompts.

Le but n'est pas de remplacer toute l'application actuelle.

Le but est de garder l'application Next/Supabase comme systeme de record, tout en remplacant la logique la plus faible aujourd'hui:

- la phase brainstorming encore coupee entre plusieurs vues et validations locales
- la generation des documents de phase concept par une succession de taches sequentielles internes
- la decomposition backlog -> waves -> taches via des prompts trop generiques

## Probleme actuel dans la codebase

### 1. Le brainstorming reste un flux separe et trop manuel

Aujourd'hui, [app/brainstorming/[projectId]/page.tsx](app/brainstorming/[projectId]/page.tsx) et [app/brainstorming/[projectId]/gdd-review/page.tsx](app/brainstorming/[projectId]/gdd-review/page.tsx) pilotent encore un workflow en plusieurs ecrans:

- one-page
- commentaires par section
- generation de GDD V1
- questions de critique
- regeneration du GDD V2

Consequence:

- CrewAI n'absorbe pas encore la pensee amont du produit
- le brainstorming et la documentation sont artificiellement separes
- l'utilisateur ne voit pas vraiment une equipe d'agents analyser le projet en direct, mais une suite d'etapes de formulaire et de review

### 2. La phase concept reste geree comme une pipeline de taches internes

Aujourd'hui, [lib/services/producerService.ts](lib/services/producerService.ts#L458) cree encore une pipeline concept sequentielle basee sur `CONCEPT_DOCS`.

Consequence:

- le GDD, la tech spec, le backlog, le course design et le README sont vus comme des livrables separes a faire avancer dans la pipeline
- cela alourdit le flux produit
- cela cree une frontiere artificielle entre documentation et planification

### 3. CrewAI n'absorbe actuellement que la planification de backlog

[lib/services/backlogPlanningService.ts](lib/services/backlogPlanningService.ts#L87) construit un payload pour `POST /plan-backlog`.

Consequence:

- CrewAI intervient tard
- CrewAI ne possede pas encore toute la responsabilite de synthese projet
- la phase documentaire et la phase de planning restent separees alors qu'elles devraient etre produites dans le meme mouvement

### 4. La pipeline dev est guidee par une logique trop generique

Le prompt actuel de [lib/services/producerService.ts](lib/services/producerService.ts#L970) demande des waves paralleles mais n'impose pas une vraie strategie de mini production.

Consequence:

- les taches peuvent etre techniquement valides mais peu naturelles
- le systeme n'impose pas la logique cle pour des mini-jeux: prototype jouable d'abord, vertical slices ensuite, integration VN a la fin
- les waves ressemblent plus a un decoupage theorique qu'a un plan realiste pour un petit jeu web

### 5. L'orchestrateur Python a encore un fallback heuristique trop faible

[crew-orchestrator/app.py](crew-orchestrator/app.py) contient encore `build_heuristic_plan(...)` et un prompt de planification principalement centre sur le backlog.

Consequence:

- le service ne porte pas encore une vision produit complete
- le fallback reproduit un decoupage lineaire tres pauvre
- le contrat d'entree/sortie ne couvre pas encore toute la phase documentaire

## Vision cible

## Principe produit

Le systeme doit simuler non pas un grand studio, mais une petite equipe qui livre vite un mini-jeu web jouable.

Le flux cible devient:

1. CrewAI absorbe le brainstorming et transforme les intentions du user en analyse structuree multi-agents.
2. CrewAI produit ensuite le GDD brut, le one-page utile et le pack documentaire complet dans le meme mouvement.
3. CrewAI produit ensuite un plan de developpement en waves verticales adapte au genre du jeu.
4. Le studio maintient une banque de prototypes et de references jouables pour alimenter les futures generations.
5. L'application persiste les taches et reste source de verite pour les statuts, l'assignation, l'execution, la review et la reprise.

En clair:

- CrewAI pense, brainstorme et planifie
- l'application orchestre et persiste

## Brainstorming cible genere et absorbe par CrewAI

CrewAI ne doit plus recevoir seulement un GDD brut deja stabilise.

CrewAI doit absorber tout le travail amont de cadrage:

- clarification du fantasy joueur
- formulation du core loop reel
- choix de scope V1
- analyse des risques
- verification de l'integration VN
- arbitrage entre ambition et faisabilite

Le resultat attendu n'est pas juste un texte final.

Le resultat attendu est un paquet de travail d'analyse:

- `onePage`
- `scopeSummary`
- `gddDraft`
- `designConflicts`
- `openQuestions`
- `decisionLog`
- `recommendedPlaybook`

Autrement dit:

- CrewAI absorbe le brainstorming
- CrewAI ne commence pas seulement apres le brainstorming

## Pack documentaire cible genere par CrewAI

CrewAI doit produire en une passe coherente:

- `docs/gdd.md`
- `docs/tech-spec.md`
- `docs/backlog.md`
- `docs/course-design.md`
- `README.md`
- eventuellement `docs/data-arch.md` si necessaire pour certains projets

Ces documents ne doivent plus etre modeles comme cinq taches pipeline utilisateur distinctes en phase concept.

## Banque de references et prototypes cible

Le studio doit construire une bibliotheque de references exploitables par les devs et par CrewAI.

Cette bibliotheque doit contenir deux familles:

- exemples externes analyses
- prototypes internes jouables

Les exemples externes ne doivent pas etre copies. Ils servent a decomposer des patterns de production:

- structure du core loop
- rythme d'introduction des mecaniques
- HUD minimal utile
- gestion de la difficulte
- type de juice acceptable

Les prototypes internes servent de socle d'inspiration concret pour les prochaines taches dev.

Ils doivent etre petits, jouables et lisibles.

Exemples de prototypes a maintenir dans le studio:

- Pong proto: balle, paddles, score, reset
- Breakout proto: balle, briques, power-up minimal
- Tetris proto: grille, pieces, lignes, game over
- Snake proto: deplacement, croissance, score
- Runner proto: saut, obstacles, vitesse progressive
- Platformer proto: mouvement, saut, collision, victoire simple
- Stealth proto: champ de vision, detection, objectif, fail state
- Dialogue infiltration proto: choix, consequence immediate, etat de suspicion
- Scoring VN proto: event `GAME_READY`, `GAME_COMPLETED`, score normalise
- HUD proto: timer, score, vie, feedback, restart

Exemples supplementaires a ajouter progressivement:

- Match-3 proto: swap, clear, combo, objectif simple
- Sokoban-lite proto: pousser, bloquer, reussite de salle
- Grapple proto: accroche, balancement minimal, reach goal
- Rhythm-lite proto: input timing, score, fail tolerance
- Defense proto: une lane, vagues, upgrade unique
- Maze chase proto: patrouille simple, collecte, extraction
- Reflex dodge proto: patterns, invulnerabilite courte, timer
- Clicker-lite proto: input cadence, feedback visuel, objectif minute
- Deck choice proto: trois cartes, effet instantane, resolution courte
- Inventory puzzle proto: combiner, verifier, livrer un objectif
- Dialogue exam proto: question, choix, score pedagogique, branche courte
- Observation proto: trouver l'indice, valider, passer a l'etape suivante

Ces protos doivent couvrir plusieurs formes de travail pour inspirer les futures tasks:

- boucle temps reel
- logique grille
- input precision
- puzzle systemique
- scoring normalise
- feedback UI court
- integration VN

Chaque proto doit produire au minimum:

- un repo ou dossier de reference
- un README tres court
- une fiche `what to reuse`
- une fiche `what not to do`

L'objectif n'est pas de faire une galerie abstraite.

L'objectif est de permettre a CrewAI et aux devs de partir d'exemples operables.

## Pipeline dev cible

La pipeline dev doit suivre un schema de mini-studio:

1. Prototype jouable minimum
2. Boucle de jeu complete
3. Feedback joueur et HUD
4. Contenu ou variantes minimales
5. Integration VN et scoring
6. Polish leger et stabilisation

Ce schema doit etre specialise par type de jeu.

Exemples:

- Pong-like: scene, balle, paddles -> collisions + score -> HUD + restart -> audio/juice -> postMessage VN
- Tetris-like: grille + chute -> rotation + collision -> lignes + score -> HUD + game over -> integration VN
- Mini platformer: player controller -> tilemap/niveau -> obstacles + victoire -> HUD -> collectibles/score -> integration VN
- Infiltration legere: carte jouable -> detection/gardes -> objectif + echec -> UI feedback -> score/stealth rating -> integration VN

## Architecture cible dans cette codebase

## Ce qui reste dans l'application actuelle

Responsabilites a conserver:

- stockage des sessions et messages de brainstorming
- lecture des projets et documents
- stockage Supabase
- `pipeline_tasks`
- assignation d'agent
- execution des taches
- review et approbation
- rattrapage de waves

Les services existants restent donc centraux:

- [lib/services/brainstormingService.ts](lib/services/brainstormingService.ts)
- [lib/services/producerService.ts](lib/services/producerService.ts)
- [lib/services/pipelineService.ts](lib/services/pipelineService.ts)
- [app/api/pipeline/[projectId]/generate/route.ts](app/api/pipeline/[projectId]/generate/route.ts)

## Ce qui doit basculer dans CrewAI

CrewAI doit prendre la responsabilite de:

- analyse du brainstorming
- synthese des tensions produit avant redaction
- synthese documentaire concept
- structuration backlog final
- decomposition en waves verticales
- justification de planning
- adaptation du plan au genre, au moteur et au scope reel du mini-jeu
- recommandation de references et de prototypes inspires

Le dossier [crew-orchestrator/app.py](crew-orchestrator/app.py) doit devenir la facade d'un orchestrateur plus riche, pas seulement d'un planner de backlog.

## Nouveau contrat cible avec CrewAI

Au lieu d'un unique `POST /plan-backlog`, viser trois etapes logiques sous la meme responsabilite CrewAI:

1. `POST /brainstorm-project`
2. `POST /plan-project-docs`
3. `POST /plan-dev-waves`

Alternative acceptable pour le premier increment:

- un seul endpoint `POST /plan-project` qui renvoie a la fois les documents et les waves

Je recommande l'alternative en trois endpoints pour garder des validations simples et limiter les pannes transverses.

## Contrat `brainstorm-project`

Entree:

- projet
- brief user brut
- historique de session si present
- contraintes pedagogiques et VN
- agents disponibles pour le brainstorming

Sortie:

- `onePage`
- `scopeSummary`
- `gddDraft`
- `designConflicts`
- `openQuestions`
- `decisionLog`
- `prototypeReferences`

Exemple de sortie:

```json
{
   "summary": "Brainstorming consolide pour Jump Spy.",
   "onePage": "# One Page...",
   "scopeSummary": "Prototype stealth web compact avec une boucle infiltration + extraction.",
   "gddDraft": "# GDD brut...",
   "designConflicts": ["Le dialogue ne doit pas ralentir la boucle infiltration."],
   "openQuestions": ["Le score doit-il penaliser la detection ou seulement la capture ?"],
   "decisionLog": ["Le scope V1 garde une seule map et un seul objectif."],
   "prototypeReferences": ["stealth-proto-basic", "hud-alert-state"]
}
```

## Contrat `plan-project-docs`

Entree:

- projet
- sortie `brainstorm-project`
- decisions cours espion
- agents actifs

Sortie:

- contenu des documents cibles
- resume de coherence
- warnings eventuels

Exemple de sortie:

```json
{
  "summary": "Pack documentaire coherent pour Jump Spy.",
  "warnings": [],
  "documents": {
    "gdd": "# GDD...",
    "techSpec": "# Tech Spec...",
    "backlog": "# Backlog...",
    "courseDesign": "# Course Design...",
    "readme": "# README...",
    "dataArch": "# Data Arch..."
  }
}
```

## Contrat `plan-dev-waves`

Entree:

- projet
- pack documentaire valide
- repo snapshot si disponible
- agents actifs
- contraintes de mini-studio

Sortie:

- `planningSummary`
- `warnings`
- `playbookType`
- `waves`

Le contrat de tache reste proche de l'existant pour minimiser le cout de migration.

Ajouter cependant des champs utiles:

- `playbook_type`: `pong-like`, `tetris-like`, `platformer-lite`, `stealth-lite`, `custom`
- `slice_type`: `prototype`, `core-loop`, `ui-feedback`, `content`, `integration`, `polish`
- `review_checklist`: liste courte pour aider la review pipeline

## Refonte UI cible - Brainstorming et documentation assistee par CrewAI

La refonte ne doit pas seulement changer les endpoints.

Elle doit changer la perception du travail en cours.

Aujourd'hui, l'UI brainstorming montre surtout:

- un ecran one-page
- des commentaires par section
- un ecran de review GDD

La cible doit montrer une vraie salle d'analyse agentique.

## Principes UI

1. On doit voir les agents travailler en direct sur le projet.
2. On doit voir quelle analyse est en cours et quelle tension produit est en train d'etre tranchee.
3. On doit voir les livrables se construire progressivement.
4. L'utilisateur doit pouvoir intervenir sur une decision ou un conflit, pas seulement commenter un texte final.

## Vue cible

La phase brainstorming/documentation doit devenir une surface unique composee de panneaux synchronises:

- panneau `Contexte projet`
- panneau `Agents en travail`
- panneau `Analyses en cours`
- panneau `Decisions verrouillees`
- panneau `Questions ouvertes`
- panneau `Documents qui se construisent`
- panneau `References et protos suggeres`

## Comportements UI attendus

- chaque agent visible a un role courant: producteur, game design, tech, UX, critique
- chaque agent emet des cartes d'analyse courtes, pas de longs blocs opaques
- les conflits detectes apparaissent dans une colonne dediee avec option `trancher`
- les documents se mettent a jour section par section
- le user peut demander `regen cette section`, `garde cette decision`, `change de direction`
- la progression visible ne repose plus sur des boutons `generate`, `regenerate`, `validate` seulement

## Surfaces probables a refondre

- [app/brainstorming/[projectId]/page.tsx](app/brainstorming/[projectId]/page.tsx)
- [app/brainstorming/[projectId]/gdd-review/page.tsx](app/brainstorming/[projectId]/gdd-review/page.tsx)
- nouveaux composants `components/brainstorming/*`

## Phase UX specifique

Objectif:

- transformer le brainstorming documentaire en experience vivante d'analyse multi-agents

Changements:

1. Fusionner one-page et GDD-review dans une experience continue.
2. Introduire une timeline d'analyse visible.
3. Introduire des cartes de contributions agent par agent.
4. Introduire un panneau de decisions et conflits resolubles.
5. Introduire un panneau de suggestions de proto et de references.
6. Rendre visible le passage `brainstorm -> docs -> playbook -> backlog` dans un seul flux.

Impact attendu:

- perception beaucoup plus forte de CrewAI comme equipe de travail
- moins de friction entre ideation et documentation
- meilleure comprehension du pourquoi derriere les documents produits

## Strategie de refonte

## Phase 1 - Basculer le brainstorming et la documentation concept vers CrewAI

Objectif:

- supprimer la separation artificielle entre brainstorming et documentation
- supprimer la notion de pipeline documentaire interne comme sequence utilisateur
- remplacer la creation de `CONCEPT_DOCS` par une generation centralisee CrewAI
- remplacer la logique one-page puis GDD-review par une orchestration d'analyse multi-agents

Changements:

1. Creer un nouveau service par exemple `lib/services/brainstormOrchestrationService.ts` pour:
   - construire le payload brainstorming
   - appeler l'orchestrateur CrewAI
   - persister `onePage`, `scopeSummary`, `gddDraft`, `decisionLog`, `openQuestions`
2. Remplacer dans [lib/services/producerService.ts](lib/services/producerService.ts#L458) la logique `generateConceptPipeline(...)` par une logique `generateProjectDocsWithCrewAI(...)` alimentee par la sortie brainstorming CrewAI.
3. Creer un nouveau service par exemple `lib/services/projectDocumentationService.ts` pour:
   - construire le payload documentaire
   - appeler l'orchestrateur CrewAI
   - valider la reponse
   - persister les documents dans le repo ou dans les livrables associes
4. Modifier [app/api/pipeline/[projectId]/generate/route.ts](app/api/pipeline/[projectId]/generate/route.ts) pour que la phase `concept` ne cree plus 5 taches sequentielles mais:
   - genere le pack documentaire via CrewAI
   - stocke les documents
   - marque la phase documentaire comme terminee
5. Rebrancher [lib/services/brainstormingService.ts](lib/services/brainstormingService.ts) pour qu'il stocke surtout l'historique et l'etat, pas la logique principale de redaction.
6. Conserver la review uniquement la ou elle a une vraie valeur produit:
   - review humaine du GDD final si necessaire
   - review de coherence documentaire globale
   - pas une review separee par fichier pour chaque document

Impact attendu:

- pipeline concept beaucoup plus courte
- brainstorming beaucoup plus fort et moins formulaire
- moins de friction UI
- documents plus coherents entre eux
- CrewAI devient l'endroit naturel de synthese projet

## Phase 2 - Introduire des playbooks de mini-studio par genre

Objectif:

- sortir de la planification abstraite
- imposer une structure de production realiste pour des mini-jeux web simples

Changements:

1. Ajouter dans l'orchestrateur Python des playbooks de planning minimaux:
   - `pong-like`
   - `tetris-like`
   - `platformer-lite`
   - `stealth-lite`
   - `fallback-mini-arcade`
2. Ajouter une fonction de classification projet qui choisit le playbook selon:
   - `project.genre`
   - `courseInfo.mechanics`
   - `engine`
   - taille du scope detectee dans les docs
3. Modifier le prompt CrewAI pour qu'il ne genere pas librement toute la structure, mais complete un squelette de production impose.
4. Garder la souplesse seulement sur:
   - le nom exact des taches
   - les fichiers cibles
   - les dependances fines
   - les notes de planning

Impact attendu:

- waves plus credibles
- taches plus concretes
- meilleure reproductibilite entre projets comparables

## Phase 3 - Refaire la construction des waves dev dans l'application

Objectif:

- garder le schema de persistence actuel
- remplacer la logique de generation par une integration CrewAI plus stricte

Changements:

1. Remplacer progressivement l'usage direct de `buildDevWavesPrompt(...)` dans [lib/services/producerService.ts](lib/services/producerService.ts#L970).
2. Garder `createDevTasksFromWaveDefs(...)` et `createNextWaveTasksFromCrewAIWave(...)` comme points de persistence si leur contrat reste stable.
3. Renforcer la validation des taches normalisees pour refuser:
   - taches trop grosses
   - livrables hors repo
   - integrations VN trop precoces
   - dependances incoherentes
4. Faire porter a `backlogPlanningService` ou a un nouveau `devWavePlanningService` la responsabilite de l'appel CrewAI.

Impact attendu:

- migration a faible risque
- peu de casse sur la persistence existante
- refonte concentree sur la planification, pas sur tout le pipeline

## Phase 4 - Construire la banque d'exemples et de protos de reference

Objectif:

- donner aux devs et a CrewAI des artefacts concrets d'inspiration

Changements:

1. Creer un dossier de references type `docs/prototype-playbooks/` ou `prototypes/`.
2. Ajouter pour chaque famille de mini-jeu:
   - une fiche de pattern
   - un mini proto jouable quand c'est pertinent
   - une liste `what to steal` et `what to avoid`
3. Faire remonter ces references dans le contrat CrewAI sous forme de `prototypeReferences`.
4. Exposer ces references a la future UI brainstorming/documentation.

Impact attendu:

- meilleurs points de depart pour les devs
- moins de generations vagues
- alignement progressif des futures taches avec de vrais exemples jouables

## Phase 5 - Refonte UI brainstorming + documentation assistee par CrewAI

Objectif:

- rendre visible et pilotable le travail d'analyse direct des agents

Changements:

1. Refondre [app/brainstorming/[projectId]/page.tsx](app/brainstorming/[projectId]/page.tsx) en cockpit unique de brainstorming.
2. Fusionner le flux de [app/brainstorming/[projectId]/gdd-review/page.tsx](app/brainstorming/[projectId]/gdd-review/page.tsx) dans cette surface.
3. Creer des composants de visualisation du travail des agents:
   - cartes d'analyse
   - timeline d'activite
   - panneaux de conflits
   - panneaux de decisions
   - construction en direct des documents
4. Ajouter une colonne `references et protos suggeres` visible pendant l'analyse.
5. Ajouter des actions courtes cote user:
   - `conserver`
   - `regenerer cette section`
   - `reduire le scope`
   - `prendre le playbook stealth-lite`

Impact attendu:

- l'utilisateur voit vraiment les agents travailler
- le brainstorming devient une experience d'analyse et pas juste de commentaire
- la documentation parait emerger d'un travail collectif visible

## Phase 6 - Aligner l'UI pipeline avec le nouveau modele

Objectif:

- rendre visible le passage d'un vieux pipeline documentaire + waves generiques a un flux mini-studio

Changements:

1. Adapter [components/pipeline/DevPipelineView.tsx](components/pipeline/DevPipelineView.tsx) pour afficher:
   - le `playbookType`
   - le type de slice de chaque tache
   - le but produit de la wave
2. Remplacer les libelles trop abstraits par des libelles utiles:
   - `Prototype jouable`
   - `Core loop complet`
   - `HUD et feedback`
   - `Integration VN`
   - `Polish`
3. Afficher dans l'UI un resume court de la logique de planification pour aider la review utilisateur.

Impact attendu:

- meilleure lisibilite produit
- perception immediate que la pipeline suit une logique de fabrication de jeu reelle

## Phase 7 - Revoir le fallback heuristique pour qu'il reste acceptable

Objectif:

- eviter qu'une panne OpenRouter ou CrewAI fasse retomber la qualite a un niveau mediocre

Changements:

1. Remplacer `build_heuristic_plan(...)` dans [crew-orchestrator/app.py](crew-orchestrator/app.py) par un fallback mini-studio deterministic.
2. Le fallback doit utiliser les memes `playbook_type` et `slice_type` que le plan nominal.
3. Le fallback ne doit jamais:
   - creer des waves arbitraires basees uniquement sur des chunks de backlog
   - melanger core gameplay et integration finale dans la meme premiere wave
   - proposer des chemins de fichiers fantaisistes sans rapport avec la stack

Impact attendu:

- comportement degrade acceptable
- moins de surprises en environnement incomplet

## Fichiers cibles

### Refactor fort probable

- [app/brainstorming/[projectId]/page.tsx](app/brainstorming/[projectId]/page.tsx)
- [app/brainstorming/[projectId]/gdd-review/page.tsx](app/brainstorming/[projectId]/gdd-review/page.tsx)
- [lib/services/brainstormingService.ts](lib/services/brainstormingService.ts)
- [lib/services/producerService.ts](lib/services/producerService.ts)
- [lib/services/backlogPlanningService.ts](lib/services/backlogPlanningService.ts)
- [app/api/pipeline/[projectId]/generate/route.ts](app/api/pipeline/[projectId]/generate/route.ts)
- [crew-orchestrator/app.py](crew-orchestrator/app.py)
- [lib/types/planning.ts](lib/types/planning.ts)
- [components/pipeline/DevPipelineView.tsx](components/pipeline/DevPipelineView.tsx)

### Nouveaux fichiers probables

- `lib/services/brainstormOrchestrationService.ts`
- `lib/services/projectDocumentationService.ts`
- `lib/services/devWavePlanningService.ts`
- `lib/types/projectPlanning.ts` si le contrat grossit trop
- `crew-orchestrator/playbooks.py` ou equivalent
- `crew-orchestrator/prompts.py` ou equivalent
- `components/brainstorming/AgentWorkstream.tsx`
- `components/brainstorming/AnalysisBoard.tsx`
- `components/brainstorming/DecisionPanel.tsx`
- `components/brainstorming/PrototypeReferencePanel.tsx`

## Sequence d'implementation recommandee

1. Stabiliser le contrat brainstorming CrewAI.
2. Brancher le brainstorming CrewAI sur la phase concept.
3. Stabiliser le contrat documentaire CrewAI.
4. Persister les documents sans pipeline documentaire sequentielle.
5. Introduire les playbooks mini-studio dans l'orchestrateur.
6. Construire la banque de protos et de references.
7. Remplacer la generation des dev waves par ces playbooks.
8. Refondre l'UI brainstorming/documentation.
9. Adapter l'UI pipeline.
10. Durcir le fallback heuristique.

## Criteres d'acceptation

### Documentation

- le brainstorming n'est plus une simple succession de pages de redaction et review
- CrewAI produit une analyse exploitable avant la documentation finale
- un projet `concept` ne cree plus cinq taches documentaires successives
- CrewAI produit un pack documentaire coherent en une phase unifiee
- les documents sont persistants et exploitables par la suite de la pipeline

### References et protos

- le studio dispose de plusieurs exemples et prototypes jouables reutilisables
- CrewAI peut recommander des references de proto adaptees au projet courant
- les devs ont des points d'inspiration concrets pour lancer les nouvelles waves

### Development waves

- la wave 1 produit toujours un prototype jouable ou un premier slice executable
- les waves suivent une logique verticale de mini-jeu
- l'integration VN n'apparait qu'apres un gameplay jouable
- les taches ont des livrables repo plausibles pour cette codebase

### UX pipeline

- l'utilisateur comprend la logique de production de chaque wave sans lire le prompt interne
- les libelles refletent un flux de fabrication de mini-jeu, pas une taxonomie abstraite

### UX brainstorming

- l'utilisateur voit les agents travailler en direct sur l'analyse du projet
- l'utilisateur peut intervenir sur les decisions et conflits, pas seulement commenter un texte
- la documentation emerge visiblement du brainstorming CrewAI

### Resilience

- si CrewAI degrade, le fallback reste exploitable et garde le modele mini-studio

## Risques a surveiller

1. Vouloir faire absorber brainstorming, documentation et planning par un seul mega endpoint trop tot.
2. Garder trop de logique concurente entre `brainstormingService`, `producerService` et l'orchestrateur.
3. Sur-specialiser les playbooks trop vite avant d'avoir valide 2 ou 3 genres principaux.
4. Casser l'UI brainstorming en affichant du faux travail agentique au lieu de vraies cartes d'analyse.
5. Casser l'UI pipeline en changeant trop tot le contrat de planning sans adaptation incrementale.

## Recommendation finale

La bonne refonte n'est pas de jeter la pipeline actuelle.

La bonne refonte est:

- CrewAI absorbe toute la documentation projet
- CrewAI absorbe aussi le brainstorming et l'analyse amont
- CrewAI planifie ensuite la production avec des playbooks de mini-studio
- le studio maintient une bibliotheque de prototypes et de references reelles
- l'application actuelle garde la persistence, l'execution et la review

Autrement dit:

- on retire a l'app la generation intelligente
- on garde a l'app l'orchestration fiable

C'est la refonte la plus coherente avec cette codebase et avec le type de jeux que le studio produit.