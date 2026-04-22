# Plan d'implémentation v2 — Pipeline CrewAI réel + Mini-studio + Page Proto

Date: 2026-04-21  
Remplace: `implementation-plan-pipeline-crewai-mini-studio-2026-04-21.md`

---

## Ce qui change par rapport au plan v1

| Sujet | v1 | v2 |
|---|---|---|
| CrewAI | Nommé mais absent (httpx direct) | Vrais `Agent`, `Task`, `Crew` Python |
| Rôles agents | Vagues, liés au LLM | Interchangeables, assignés aux agents du studio |
| Participation user | Réactive (valide après coup) | Avant (wizard 3 questions) + pendant (panel Décisions) |
| Contexte inter-sessions | Absent — CrewAI repose les mêmes questions | `GameBrief` persisté injecté dans chaque payload |
| Mini panneau brief | Non prévu | Bandeau fixe en haut de page projet + brainstorming |
| Page protos jouables | Mentionnée sans implémentation | `/proto` avec iframe + fiches `what to reuse` |
| Format protos | Non défini | 3 fichiers HTML/CSS/JS purs par proto |

---

## Problèmes confirmés dans la v1

### 1. CrewAI est absent en pratique

`crew-orchestrator/app.py` ne contient aucun import `crewai`. C'est un service FastAPI qui appelle OpenRouter via `httpx` avec un prompt monolithique, avec un fallback heuristique basique si la clé API manque.

**Conséquence directe** :
- Pas de decomposition de raisonnement entre agents
- Pas de mémoire ou de contexte inter-tâches
- Pas de critique croisée entre rôles
- Le nom "CrewAI" est trompeur

### 2. L'utilisateur n'a pas assez de prise avant le run

Le plan v1 prévoit que l'utilisateur peut "trancher" des conflits ou "conserver" des décisions, mais seulement après que CrewAI a produit un résultat. Il n'y a pas de moment où l'utilisateur cadre le projet avant que l'analyse commence.

**Conséquence** : CrewAI repart de zéro à chaque session et repose les mêmes questions fondamentales (scope, genre, prototype d'inspiration).

### 3. Le GameBrief existe mais n'est pas injecté dans les payloads CrewAI

`GameBrief` est défini dans `lib/types/brainstorming.ts` avec `genre`, `sessionDuration`, `referenceGame`, `theme`. Il n'est pas transmis à `crew-orchestrator/app.py` et n'est pas affiché dans le flux pipeline.

**Conséquence** : les décisions déjà prises (genre, référence, scope de session) ne persistent pas dans l'outil.

### 4. La page proto est mentionnée mais non implémentée

Le plan v1 liste une vingtaine de prototypes à créer mais ne définit pas :
- la structure de fichiers des protos
- la route Next.js pour y jouer
- le format de la fiche `what to reuse`
- le lien avec CrewAI (`prototypeReferences` dans les payloads)

---

## Vision cible v2

```
Wizard rapide (3 questions)
        ↓
GameBrief persisté (genre, durée, référence, thème)
        ↓                              ↓
Bandeau sticky projet          Injecté dans chaque payload CrewAI
        ↓
CrewAI — vrais Agent+Task+Crew
  Producteur (assigné à un agent studio)
  Game Designer (assigné à un agent studio)
  Tech Lead (assigné à un agent studio)
  Critique QA (assigné à un agent studio)
        ↓
Panel Décisions ouvertes (user résout en direct)
        ↓
Documents + Waves + PlaybookType
        ↓
Pipeline DevPipelineView enrichie
        ↓
/proto — jouer aux protos depuis le studio
```

---

## Principe fondamental : rôles interchangeables

Les rôles CrewAI ne sont pas liés à des personnages fixes. Chaque rôle est un **masque fonctionnel** qui peut être porté par n'importe quel agent du studio.

Exemples :
- Karim peut être `Tech Lead` sur Jump Spy mais `Producteur` sur un autre projet
- Le rôle `Critique QA` peut être assigné à l'agent qui a la personnalité la plus directe

Implémentation :
- Chaque `Agent` CrewAI reçoit `role`, `goal`, `backstory` construits dynamiquement depuis le profil de l'agent studio
- Le rôle est passé dans le payload : `{ "slug": "karim", "crewai_role": "tech_lead" }`
- La fonction Python construit le `crewai.Agent` avec les infos fusionnées

---

## Architecture CrewAI cible

### Structure des fichiers Python

```
crew-orchestrator/
  app.py                  # FastAPI — routes uniquement
  models.py               # Pydantic models (déplacer depuis app.py)
  playbooks.py            # Playbooks mini-studio par genre
  crews/
    brainstorm_crew.py    # Crew pour /brainstorm-project
    docs_crew.py          # Crew pour /plan-project-docs
    waves_crew.py         # Crew pour /plan-dev-waves
  prompts/
    brainstorm.py         # System prompts brainstorming
    docs.py               # System prompts documentation
    waves.py              # System prompts planning waves
  tools/
    proto_lookup.py       # Outil pour consulter la banque de protos
```

### Trois endpoints créés progressivement

```
POST /brainstorm-project    # Phase 1 — analyse multi-agents
POST /plan-project-docs     # Phase 2 — pack documentaire
POST /plan-dev-waves        # Phase 3 — waves mini-studio
```

Le endpoint `/plan-backlog` existant reste actif pendant la migration.

---

## Contrat GameBrief injecté dans tous les payloads

### Ce qui existe déjà

```typescript
// lib/types/brainstorming.ts
export interface GameBrief {
  genre: GameGenre;           // "stealth" | "arcade" | "puzzle" | "action" | "rpg" | "autre"
  sessionDuration: SessionDuration; // "2min" | "5min" | "15min"
  referenceGame: string;      // ex: "Metal Gear Solid" ou "stealth-proto-basic"
  theme: string;
}
```

### Ce qu'on ajoute

```typescript
export interface GameBriefExtended extends GameBrief {
  lockedDecisions: string[];  // ex: ["scope V1 = une seule map", "pas de boss"]
  prototypeRef: string | null; // slug du proto interne ex: "stealth-proto"
  scopeNote: string | null;   // note courte de contrainte de scope
}
```

### Injection dans les payloads Python

```python
class GameBriefPayload(BaseModel):
    genre: str
    sessionDuration: str
    referenceGame: str
    theme: str
    lockedDecisions: list[str] = Field(default_factory=list)
    prototypeRef: str | None = None
    scopeNote: str | None = None
```

Ce champ est ajouté à `PlanningRequest`, `BrainstormRequest`, `DocsRequest`.

Chaque Agent CrewAI reçoit le GameBrief dans son `backstory` ou dans le contexte de sa `Task`.

---

## Wizard utilisateur avant le run CrewAI

### Principe

Avant chaque run CrewAI (brainstorming ou re-run), un wizard rapide à 3 questions :

1. **Genre et mécanique principale** — choix parmi les genres connus + saisie libre
2. **Prototype d'inspiration** — sélection dans la banque de protos existants ou saisie d'un jeu externe
3. **Contrainte de scope V1** — ex: "une seule map", "pas de score", "temps de jeu 2 min max"

Ces 3 réponses alimentent le `GameBriefExtended` et sont persistées en Supabase avant que CrewAI soit appelé.

### Composant Next.js cible

```
components/brainstorming/
  BriefWizard.tsx        # Modal wizard 3 étapes
  BriefBanner.tsx        # Bandeau sticky en haut des pages projet/brainstorming
```

### Quand ce wizard apparaît

- Premier run brainstorming d'un projet (toujours)
- Re-run si le GameBrief est vide ou incomplet
- Bouton "Modifier le brief" dans le bandeau sticky

---

## Bandeau sticky GameBrief

### Position

Bandeau fixe en haut des pages :
- `/projects/[id]`
- `/brainstorming/[projectId]`
- Éventuellement visible depuis la pipeline

### Contenu affiché

```
[ Jump Spy ]  Genre: stealth  |  Réf: Metal Gear Solid  |  Scope: 1 map, 2min  |  [ Modifier ]
```

### Comportement

- Cliquable → ouvre `BriefWizard` pour modifier
- Lecture seule si pipeline en cours (verrouillage optionnel)
- Données issues de `GameBriefExtended` persisté en Supabase

---

## Panel Décisions ouvertes (pendant le run)

### Principe

Pendant que CrewAI analyse (streaming ou polling), un panneau latéral affiche les `openQuestions` retournées par la Crew.

Chaque question a trois actions :
- `Valider` — ajoute à `lockedDecisions` dans `GameBriefExtended`
- `Ignorer` — retire de la liste sans impact
- `Modifier le brief` — ouvre le wizard pour recadrer

### Format des open questions (sortie CrewAI)

```json
{
  "openQuestions": [
    {
      "id": "q1",
      "question": "Le score doit-il pénaliser la détection ou seulement la capture ?",
      "suggestedAnswer": "Pénaliser seulement la capture pour garder la boucle fluide.",
      "impactZone": "game-design"
    }
  ]
}
```

### Composant Next.js cible

```
components/brainstorming/
  OpenQuestionsPanel.tsx    # Panel latéral décisions
  DecisionCard.tsx          # Carte individuelle avec actions
```

---

## Vrais objets CrewAI — implémentation

### Installation requise

```
pip install crewai crewai-tools
```

### Exemple de Crew brainstorming

```python
# crews/brainstorm_crew.py
from crewai import Agent, Task, Crew, Process

def build_brainstorm_crew(
    payload: BrainstormRequest,
    agent_profiles: list[dict],  # profils agents studio
) -> Crew:

    # Construire les agents CrewAI depuis les profils studio
    producteur = Agent(
        role="Producteur",
        goal="Cadrer le scope V1 réaliste pour un mini-jeu web en tenant compte des contraintes pédagogiques.",
        backstory=_build_backstory(agent_profiles, "producteur", payload.gameBrief),
        llm=_get_llm(),
        verbose=False,
    )

    game_designer = Agent(
        role="Game Designer",
        goal="Définir le core loop, la fantasy joueur et le périmètre V1 sans ambiguïté.",
        backstory=_build_backstory(agent_profiles, "game_designer", payload.gameBrief),
        llm=_get_llm(),
        verbose=False,
    )

    tech_lead = Agent(
        role="Tech Lead",
        goal="Valider la faisabilité technique dans la stack web (Phaser/HTML/CSS/JS) et identifier les risques d'intégration VN.",
        backstory=_build_backstory(agent_profiles, "tech_lead", payload.gameBrief),
        llm=_get_llm(),
        verbose=False,
    )

    critique = Agent(
        role="Critique QA",
        goal="Identifier les conflits de design, les zones d'ambiguïté et les questions ouvertes bloquantes.",
        backstory=_build_backstory(agent_profiles, "critique", payload.gameBrief),
        llm=_get_llm(),
        verbose=False,
    )

    # Tasks séquentielles
    task_cadrage = Task(
        description=f"Analyser le brief projet '{payload.project.title}' et produire une synthèse de cadrage: one page, scope summary, design conflicts.",
        agent=producteur,
        expected_output="JSON avec onePage, scopeSummary, designConflicts",
    )

    task_core_loop = Task(
        description="Définir précisément le core loop et la fantasy joueur à partir du cadrage Producteur.",
        agent=game_designer,
        context=[task_cadrage],
        expected_output="JSON avec coreLoop, playerFantasy, perimetreV1",
    )

    task_tech = Task(
        description="Valider la faisabilité technique et identifier les références de prototypes internes utilisables.",
        agent=tech_lead,
        context=[task_cadrage, task_core_loop],
        expected_output="JSON avec techRisks, prototypeReferences, stackNotes",
    )

    task_critique = Task(
        description="Synthétiser les tensions, conflits et questions ouvertes. Produire le decisionLog et les openQuestions.",
        agent=critique,
        context=[task_cadrage, task_core_loop, task_tech],
        expected_output="JSON avec designConflicts, openQuestions, decisionLog, recommendedPlaybook",
    )

    return Crew(
        agents=[producteur, game_designer, tech_lead, critique],
        tasks=[task_cadrage, task_core_loop, task_tech, task_critique],
        process=Process.sequential,
        verbose=False,
    )


def _build_backstory(profiles: list[dict], role: str, brief: dict) -> str:
    # Chercher l'agent studio assigné à ce rôle
    agent = next((p for p in profiles if p.get("crewai_role") == role), None)
    name = agent["name"] if agent else role.capitalize()
    dept = agent.get("department", "studio") if agent else "studio"
    return (
        f"Tu es {name}, {dept} chez Eden Studio. "
        f"Tu travailles sur '{brief.get('referenceGame', 'un mini-jeu web')}' de genre {brief.get('genre', 'arcade')}. "
        f"Scope contrainte: {brief.get('scopeNote', 'mini-jeu web compact, 2-5 minutes de jeu')}."
    )
```

### Pattern général pour les trois Crews

| Endpoint | Crew | Process | Agents |
|---|---|---|---|
| `/brainstorm-project` | `BrainstormCrew` | sequential | Producteur → Game Designer → Tech Lead → Critique |
| `/plan-project-docs` | `DocsCrew` | sequential | Rédacteur GDD → Rédacteur Tech → Rédacteur Backlog → Reviewer |
| `/plan-dev-waves` | `WavesCrew` | sequential | Producteur → Planificateur → Tech → Validateur |

Le `Process.sequential` est recommandé pour la v1 car il est déterministe, traçable et compatible avec le fallback heuristique existant.

---

## Page /proto — jouer à tous les prototypes

### Route Next.js

```
app/proto/
  page.tsx          # Grille de toutes les cartes proto
  [slug]/
    page.tsx        # Vue détail proto avec iframe + fiche
```

### Structure des fichiers proto

Chaque prototype est autonome dans `/public/prototypes/` :

```
public/
  prototypes/
    stealth-proto/
      index.html    # Jeu complet auto-contenu
      style.css
      main.js
    scoring-vn-proto/
      index.html
      style.css
      main.js
    platformer-lite/
      index.html
      style.css
      main.js
```

### Format de la fiche proto

Un fichier JSON de métadonnées par proto dans `lib/data/prototypes/` :

```typescript
// lib/types/proto.ts
export interface ProtoMeta {
  slug: string;
  title: string;
  genre: string[];
  mechanics: string[];
  whatToReuse: string[];
  whatToAvoid: string[];
  playbookType: string;
  crewaiTag: string;    // tag utilisé dans prototypeReferences CrewAI
  previewDescription: string;
}
```

### Exemple fiche stealth-proto

```json
{
  "slug": "stealth-proto",
  "title": "Stealth Proto",
  "genre": ["stealth"],
  "mechanics": ["champ de vision", "détection", "objectif", "fail state"],
  "whatToReuse": [
    "Cône de vision raycast simple en canvas",
    "Machine à états garde: patrol → alert → chase",
    "Feedback audio minimal sur détection",
    "Score stealth-rating basé sur détections"
  ],
  "whatToAvoid": [
    "IA garde avec pathfinding complexe en V1",
    "Plusieurs objectifs simultanés",
    "Système d'inventaire avant la boucle de base"
  ],
  "playbookType": "stealth-lite",
  "crewaiTag": "stealth-proto-basic",
  "previewDescription": "Boucle stealth minimale: map, garde, objectif, détection, fail state."
}
```

### Page grille `/proto`

Composant `ProtoGrid` : cartes avec :
- Titre + genre tag
- `previewDescription`
- Bouton `Jouer` → iframe dans la page detail
- Bouton `Voir la fiche` → scroll vers `whatToReuse` / `whatToAvoid`

### Page détail `/proto/[slug]`

- Moitié haute : iframe `src="/prototypes/[slug]/index.html"` avec resize
- Moitié basse : fiche `what to reuse` + `what to avoid` + mécaniques

---

## Protos à créer en priorité

### Stealth Proto (priorité 1 — aligné sur Jump Spy)

3 fichiers, HTML/CSS/JS pur :

```
index.html — canvas 600x400, garde, joueur, objectif, fail state
style.css  — fond sombre, HUD minimaliste
main.js    — requestAnimationFrame, cône de vision, machine à états garde
```

Boucle minimale :
1. Joueur se déplace (WASD ou flèches)
2. Garde patrouille sur un chemin fixe avec un cône de vision
3. Si joueur entre dans le cône → alerte → Game Over
4. Joueur atteint l'objectif → Win
5. Score basé sur détections évitées

### Scoring VN Proto (priorité 2 — requis pour toutes les intégrations VN)

```
index.html — mini-jeu neutre avec timer 60s
style.css  — HUD propre
main.js    — émet postMessage("GAME_READY") + postMessage("GAME_COMPLETED", {score, normalizedScore})
```

C'est le proto de référence pour toutes les intégrations `postMessage` avec le moteur VN.

---

## Banque de protos et CrewAI

### Lookup tool pour CrewAI

```python
# tools/proto_lookup.py
from crewai.tools import BaseTool

class ProtoLookupTool(BaseTool):
    name: str = "proto_lookup"
    description: str = "Cherche les prototypes internes disponibles par genre ou mécanique et retourne les fiches what-to-reuse."

    def _run(self, query: str) -> str:
        # Lire lib/data/prototypes/*.json et filtrer par query
        ...
```

Ce tool est donné au `Tech Lead` et au `Planificateur` dans leurs agents CrewAI pour qu'ils recommandent des `prototypeReferences` pertinentes.

---

## Context persistence — comment CrewAI évite les questions répétées

### Règle : GameBriefExtended est injecté dans CHAQUE payload

Avant d'appeler un endpoint CrewAI, le service Next.js :
1. Charge le `GameBriefExtended` depuis Supabase pour ce projet
2. L'inclut dans le payload
3. Le service Python l'injecte dans le `backstory` de chaque agent ET dans les `Task.description`

### Règle : lockedDecisions sont injectées dans chaque Task

```python
def _inject_locked_decisions(task_desc: str, brief: GameBriefPayload) -> str:
    if not brief.lockedDecisions:
        return task_desc
    decisions = "\n".join(f"- {d}" for d in brief.lockedDecisions)
    return f"{task_desc}\n\nDécisions déjà verrouillées (ne pas remettre en question):\n{decisions}"
```

### Règle : openQuestions résolues sont ajoutées aux lockedDecisions

Quand l'utilisateur valide une `openQuestion` dans le panel, la réponse est persistée comme `lockedDecision` dans Supabase.

---

## Stratégie de refonte — phases révisées

### Phase 1 — Bandeau GameBrief sticky + Wizard

**Objectif** : rendre le contexte projet visible et persistant dans le flux.

1. Étendre `GameBrief` → `GameBriefExtended` dans `lib/types/brainstorming.ts`
2. Créer `components/brainstorming/BriefBanner.tsx` — bandeau en haut
3. Créer `components/brainstorming/BriefWizard.tsx` — modal 3 questions
4. Persister `GameBriefExtended` dans Supabase (table `brainstorming_sessions` ou `projects`)
5. Afficher le bandeau sur `/projects/[id]` et `/brainstorming/[projectId]`

**Critère** : l'utilisateur voit genre + référence + scope en haut de chaque page projet.

### Phase 2 — Page /proto jouable

**Objectif** : construire la banque de références concrètes.

1. Créer `lib/types/proto.ts` + `lib/data/prototypes/*.json`
2. Créer `public/prototypes/stealth-proto/` (3 fichiers)
3. Créer `public/prototypes/scoring-vn-proto/` (3 fichiers)
4. Créer `app/proto/page.tsx` — grille de cartes
5. Créer `app/proto/[slug]/page.tsx` — iframe + fiche
6. Créer `components/proto/ProtoCard.tsx` + `ProtoDetail.tsx`

**Critère** : on peut jouer au stealth proto et lire sa fiche `what to reuse` depuis `/proto`.

### Phase 3 — Refonte crew-orchestrator avec vrais CrewAI

**Objectif** : remplacer les appels httpx directs par de vrais Agent+Task+Crew.

1. Installer `crewai` dans `crew-orchestrator/requirements.txt`
2. Extraire `models.py` depuis `app.py`
3. Créer `crews/brainstorm_crew.py` avec les 4 agents + 4 tasks
4. Créer `crews/waves_crew.py` pour remplacer `build_planning_prompt()`
5. Créer `tools/proto_lookup.py`
6. Créer `playbooks.py` avec les playbooks mini-studio
7. Ajouter le endpoint `/brainstorm-project`
8. Garder `/plan-backlog` comme alias pendant la migration

**Critère** : un run `/brainstorm-project` produit une sortie multi-agents traçable avec les contributions de chaque rôle.

### Phase 4 — Panel Décisions ouvertes

**Objectif** : permettre à l'utilisateur d'intervenir pendant l'analyse.

1. Créer `components/brainstorming/OpenQuestionsPanel.tsx`
2. Créer `components/brainstorming/DecisionCard.tsx`
3. Brancher sur les `openQuestions` retournées par CrewAI
4. Persister les décisions validées comme `lockedDecisions`

**Critère** : l'utilisateur résout une question ouverte et la décision est verrouillée dans le brief.

### Phase 5 — Inject GameBrief dans les payloads CrewAI

**Objectif** : éviter que CrewAI repose les mêmes questions.

1. Étendre `PlanningRequest` et `BrainstormRequest` avec `gameBrief: GameBriefPayload`
2. Modifier `_build_backstory()` pour inclure `lockedDecisions`
3. Modifier `backlogPlanningService.ts` pour charger et transmettre le `GameBriefExtended`

**Critère** : un deuxième run CrewAI sur le même projet ne repose aucune question déjà verrouillée.

### Phase 6 — Playbooks mini-studio dans CrewAI

**Objectif** : remplacer la planification libre par des squelettes de production.

1. Créer `playbooks.py` avec les playbooks `stealth-lite`, `platformer-lite`, `pong-like`, `fallback`
2. Brancher le `WavesCrew` sur le playbook détecté depuis `genre` + `mechanics`
3. Compléter les playbooks avec les protos de référence disponibles

**Critère** : Wave 1 d'un projet stealth contient toujours "Prototype jouable minimum" avec référence `stealth-proto`.

### Phase 7 — Refonte UI brainstorming (cockpit multi-agents)

**Objectif** : rendre visible le travail des agents.

Reprendre les éléments de la v1 (AgentWorkstream, AnalysisBoard, DecisionPanel) en s'appuyant sur les données réelles produites par les vrais Crews.

---

## Risques corrigés par rapport à la v1

| Risque v1 | Correction v2 |
|---|---|
| "Absorber brainstorming+docs+planning dans un seul mega endpoint" | 3 endpoints séparés, migration phase par phase |
| "Faux travail agentique" | Vrais Agent+Task+Crew — chaque agent produit une sortie distincte |
| CrewAI repose les mêmes questions | GameBriefExtended + lockedDecisions injectés dans chaque payload |
| Fallback heuristique trop pauvre | Playbooks mini-studio déterministes dans `playbooks.py` |
| Protos inexistants | Protos HTML/CSS/JS purs dans `/public/prototypes/` + page `/proto` |
| User passif | Wizard avant + panel Décisions pendant |

---

## Critères d'acceptation v2

### GameBrief

- [ ] Le bandeau genre/référence/scope est visible en haut des pages projet et brainstorming
- [ ] Le wizard se déclenche automatiquement si le brief est incomplet avant un run CrewAI
- [ ] Les décisions verrouillées ne sont jamais reposées par CrewAI

### CrewAI réel

- [ ] `crew-orchestrator/app.py` importe `crewai` et utilise `Agent`, `Task`, `Crew`
- [ ] Chaque rôle (Producteur, Game Designer, Tech Lead, Critique) est assignable à un agent studio
- [ ] La sortie `/brainstorm-project` trace les contributions de chaque agent séparément

### Protos jouables

- [ ] La page `/proto` affiche une grille de cartes avec iframe
- [ ] Le stealth proto est jouable (gardes, cône de vision, objectif, fail state)
- [ ] Le scoring VN proto émet `postMessage("GAME_COMPLETED", {score})` correctement
- [ ] Chaque proto a une fiche `whatToReuse` et `whatToAvoid` lisible

### Participation user

- [ ] Le wizard 3 questions apparaît avant le premier run
- [ ] Le panel Décisions ouvertes affiche les `openQuestions` de CrewAI
- [ ] L'utilisateur peut verrouiller une décision depuis le panel

### Waves

- [ ] Wave 1 d'un projet stealth contient toujours un prototype jouable
- [ ] La wave recommande le proto interne correspondant au genre
- [ ] Le fallback heuristique respecte le playbook du genre détecté

---

## Fichiers à créer

```
lib/types/proto.ts
lib/data/prototypes/stealth-proto.json
lib/data/prototypes/scoring-vn-proto.json
app/proto/page.tsx
app/proto/[slug]/page.tsx
components/proto/ProtoCard.tsx
components/proto/ProtoDetail.tsx
components/brainstorming/BriefBanner.tsx
components/brainstorming/BriefWizard.tsx
components/brainstorming/OpenQuestionsPanel.tsx
components/brainstorming/DecisionCard.tsx
public/prototypes/stealth-proto/index.html
public/prototypes/stealth-proto/style.css
public/prototypes/stealth-proto/main.js
public/prototypes/scoring-vn-proto/index.html
public/prototypes/scoring-vn-proto/style.css
public/prototypes/scoring-vn-proto/main.js
crew-orchestrator/models.py
crew-orchestrator/playbooks.py
crew-orchestrator/crews/brainstorm_crew.py
crew-orchestrator/crews/waves_crew.py
crew-orchestrator/tools/proto_lookup.py
crew-orchestrator/prompts/brainstorm.py
crew-orchestrator/prompts/waves.py
```

## Fichiers à modifier

```
lib/types/brainstorming.ts           # Étendre GameBrief → GameBriefExtended
lib/services/backlogPlanningService.ts  # Charger et transmettre GameBriefExtended
crew-orchestrator/app.py             # Basculer vers les Crews, garder /plan-backlog
crew-orchestrator/requirements.txt   # Ajouter crewai
app/projects/[id]/page.tsx           # Afficher BriefBanner
app/brainstorming/[projectId]/page.tsx  # Afficher BriefBanner + BriefWizard
```
