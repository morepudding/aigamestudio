# Pipeline de Création de Jeu — Redesign

## Contexte

Eden Studio produit des mini-jeux espion pédagogiques (intégrés dans un Visual Novel via postMessage). Chaque jeu est développé avec effort minimum jusqu'à obtenir un premier produit jouable. La pipeline doit être **professionnelle, rapide, et ne pas perdre de temps en bavardage inutile**.

---

## Workflow Complet

```
[1. Brief]  →  [2. One Page Doc]  →  [3. GDD Pipeline]
 Template       Généré + commentaires   Existant (5 docs)
 ~2 minutes     ~5 minutes              
```

---

## Phase 1 — Brief (Template rapide)

**Objectif** : Collecter les données factuelles du concept, pas de créativité encore.

**UI** : Formulaire à choix multiples, 4 questions, champs libres assistés par IA.

| Question | Mode |
|----------|------|
| **Genre mécanique** | Choix unique : Action · Puzzle · Stealth · Arcade · RPG · Autre |
| **Durée d'une session** | Choix unique : < 2 min · 5 min · 10-15 min |
| **1 jeu de référence** | Liste curée (~100 jeux) filtrée par genre + bouton "Je sais pas → l'agent suggère" |
| **Univers / Thème** | Suggestions auto générées selon genre + durée déjà sélectionnés + champ libre pour overrider |

> **Pourquoi ces 4 questions ?**
> Genre + durée = contraintes techniques immédiates.
> Référence = ancre créative commune entre le créateur et l'agent.
> Univers = le filtre narratif appliqué sur la mécanique.

### Comportement assisté — Jeu de référence

1. Tu sélectionnes "Puzzle" + "5 min" → la liste se filtre sur les jeux puzzle courts pertinents
2. Si tu bloques : bouton **"Suggère-moi"** → l'agent propose 3-5 jeux avec 1 ligne d'explication chacun, basés sur genre + durée + thème déjà remplis
3. Tu picks dans les suggestions ou tu ignores et tu cherches dans la liste complète

### Comportement assisté — Univers / Thème

1. Dès que genre + durée sont sélectionnés → l'agent génère **3 suggestions de thème** sous forme de chips cliquables (ex: "Espion médiéval — séduction et assassinat", "Hacker cyberpunk — infiltration réseau", "Agent soviétique — guerre froide")
2. Tu cliques une suggestion ou tu la modifies librement dans le champ texte
3. Les suggestions changent dynamiquement si tu changes le genre ou la durée

**Effort de dev** : fixé à "minimum" pour tous les jeux (pas une option).

**Sortie** : un objet `GameBrief` stocké avec le projet.

---

## Phase 2 — One Page Design Document

**Objectif** : Produire un livrable structuré — pas un résumé de conversation, un **document de référence** qui fonde le GDD. L'agent le génère directement depuis le brief, sans phase de questions préalable.

**Ce que fait l'agent :**
Il lit le brief (genre + durée + référence + thème) et génère le One Page complet. S'il manque des infos ou détecte une incohérence, il le note dans "Risques identifiés" — il n'interrompt pas pour demander.

**Structure du One Page :**

```markdown
# [Titre du jeu]

## Elevator Pitch
[2 phrases max. Thème + mécanique + ce qui le rend unique.]

## Player Fantasy
[Ce que le joueur ressent, pas ce qu'il fait. Ex: "Tu te sens maître de la manipulation."]

## Core Loop
1. [Action principale — le verbe du gameplay]
2. [Feedback immédiat — ce qui se passe]
3. [Progression / récompense]

## Univers
[3-4 lignes. Contexte narratif, époque, ton.]

## Périmètre V1
**IN** :
- [Feature 1]
- [Feature 2]

**OUT** :
- [Feature hors scope]
- [Feature hors scope]

## Risques identifiés
- [Risque 1 — et pourquoi c'est un risque]
- [Risque 2]

## Intégration VN
[Comment ce jeu s'intègre dans le Visual Novel via postMessage. Score, event de fin, conditions.]
```

### Boucle de révision par section

Chaque section du One Page affiche une icône de commentaire. La boucle :

```
Doc généré
    ↓
Tu lis → tu commentes 0, 1 ou plusieurs sections
    ↓
"Régénérer" → l'agent relit le doc + tous les commentaires et produit une V2
    ↓
Tu re-commentes ou tu cliques "Valider" → GDD Pipeline
```

**Règles :**
- Un commentaire par section max (tu écrases le précédent si tu re-commentes)
- Pas de limite d'itérations, mais l'agent note dans les risques si le scope dérive
- "Valider" est disponible dès la V1 — pas de révision forcée
- Les commentaires sont effacés après chaque régénération (le doc repart propre)

---

## Phase 3 — GDD Pipeline (existante)

Inchangée. Prend le One Page comme base pour générer les 5 documents :

1. Game Design Document (`docs/gdd.md`)
2. Spécification Technique (`docs/tech-spec.md`)
3. Backlog de Développement (`docs/backlog.md`)
4. Design du Cours & Intégration VN (`docs/course-design.md`)
5. README (`README.md`)

---

## Ce qui change par rapport à l'existant

| Actuel | Nouveau |
|--------|---------|
| Sélection manuelle de 1-3 agents | 1 agent fixe (Lead Game Designer) assigné auto |
| 5 phases de chat (game-design, programming, art, dynamic, synthesis) | Génération directe depuis le brief |
| GDD V1 → critique questions → GDD V2 | One Page → commentaires par section → validation |
| Pas de template initial | Template 4 questions assisté par IA |
| Champ libre pour référence et thème | Liste curée + suggestions IA contextualisées |

---

## Modèle de prompt agent

Chaque agent a deux prompts distincts :

| Champ | Usage |
|-------|-------|
| `promptPerso` | Personnalité, ton, backstory — actif dans le chat libre |
| `promptPro` | Expertise métier — actif sur les tâches professionnelles (One Page, tâches pipeline, reviews...) |

Le `promptPro` d'un agent game-design décrit **comment ce personnage spécifiquement aborde la conception d'un jeu** — son angle d'attaque, ses priorités, ses angles morts. Ce n'est pas une catégorie générique ("mécaniques pures" / "narratif") mais quelque chose d'écrit à la main pour chaque collaborateur, cohérent avec leur backstory.

Exemple : un GD avec un background programmation va instinctivement partir des contraintes techniques. Un GD avec un background narratif va partir du personnage joueur. Cette diversité produit des One Page différents selon qui est sélectionné.

**En Phase 2** : le créateur choisit parmi les agents game-design disponibles dans son studio. Le `promptPro` de l'agent sélectionné pilote la génération du One Page.

---

## Points ouverts / à challenger

- **Le One Page est-il stocké** comme `gddOriginal` dans le projet, ou dans une nouvelle table ?
- **Migration DB** : ajouter la colonne `promptPro` à la table `agents`. Les champs existants (`personality_primary`, `personality_nuance`, `backstory`) restent inchangés et couvrent déjà le côté perso.
