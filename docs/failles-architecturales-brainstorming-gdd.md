# Failles architecturales — Pipeline Brainstorming → GDD

## Contexte

L'analyse du GDD généré (gdd.md) révèle un document complètement déconnecté de la réalité du studio. Ce document identifie pourquoi, point par point, en traçant chaque problème jusqu'à sa cause dans le code.

---

## Faille #1 — Le contexte studio n'est injecté nulle part dans la génération GDD

**Symptômes dans le GDD :**
- Ligne 10 : WWII au lieu de la Renaissance italienne
- Ligne 77 : portage Switch, builds Windows/macOS
- Ligne 85 : équipe de 5 (1 dev, 1 artiste, 1 designer, 1 historien, 1 sound designer)
- Ligne 86 : 18 mois de production, 3 phases de playtests

**Cause technique :**

Dans `lib/prompts/gddReview.ts`, la fonction `buildGddV1Prompt(project, scopeInput)` reçoit uniquement :
- `project.title`
- `scopeInput` (= `session.scopeSummary ?? project.description`)

**Il n'y a aucune injection du contexte studio dans le pipeline GDD.** Contrairement au prompt One Page qui contient ce hardcode :

> *"Eden Studio produit des mini-jeux espion pédagogiques intégrés dans un Visual Novel via postMessage..."*

Cette phrase n'existe PAS dans `buildGddV1Prompt` ni dans `buildGddV2Prompt`. Le LLM génère donc un GDD de studio fictif générique.

---

## Faille #2 — L'univers "Renaissance italienne" n'existe nulle part dans le système

**Symptôme dans le GDD :**
- Ligne 10 : Europe 1942, bureaux militaires, maisons sûres de la Résistance
- Ligne 41 : Europa 1942 (setting complet inventé)

**Cause technique :**

L'univers partagé du studio — *la Renaissance médiévale italienne, l'université des espions* — n'est stocké dans **aucune variable de configuration**. Il n'existe que dans `brief.theme` si l'utilisateur l'a tapé manuellement lors du brainstorming.

Même si l'utilisateur l'a tapé, ce champ `brief.theme` est passé à `buildOnePageGeneratePrompt` mais **pas à `buildGddV1Prompt`**. L'univers disparaît donc entre la One Page et le GDD.

Il manque un concept de **"studio universe constant"** accessible à tous les prompts.

---

## Faille #3 — La One Page n'est pas passée au GDD

**Symptôme dans le GDD :**
- Ligne 12 : les références du brainstorming (The Code Book, Human Resource Machine, Papers Please) sont listées — elles viennent du `brief.referenceGame`, mais c'est tout ce qui survit
- La mécanique centrale validée en One Page n'est pas garantie d'être reproduite fidèlement

**Cause technique :**

```
GDD V1 input = session.scopeSummary ?? project.description
```

`session.scopeSummary` est **toujours null** — aucun code ne le renseigne. La One Page validée (`session.onePage`) est ignorée.

Le GDD V1 est donc généré depuis `project.description` (souvent très court, vague), pas depuis le document One Page pourtant validé. La One Page est un cul-de-sac : elle est produite mais ne sert à rien downstream.

---

## Faille #4 — Pas de garde-fous sur les sections interdites

**Symptômes dans le GDD :**
- Section "Monétisation" (ligne 70) avec modèle premium 15-20€ et DLC
- Section "Contraintes > Plateformes" (ligne 77-79) avec Switch, Windows, macOS
- Section "Contraintes > Production" (ligne 85-86) avec équipe de 5, 18 mois, playtests

**Cause technique :**

Le template GDD dans `buildGddV1Prompt` contient des sections standard (Vision, Gameplay, Univers, Structure, **Monétisation**, **Contraintes**) sans aucune directive d'exclusion pour le contexte Eden Studio.

Il n'y a aucune instruction du type :
- "Pas de monétisation — les mini-jeux sont gratuits"
- "Plateforme unique : web/React"
- "Pas de playtests — studio IA"
- "Équipe : agents IA uniquement"

---

## Faille #5 — La core loop est floue parce que le scope arrive tronqué

**Symptôme dans le GDD :**
- Ligne 21-24 : core loop en 4 étapes mais sans préciser comment la mécanique drag-and-drop fonctionne concrètement

**Cause technique :**

`scopeInput = project.description` qui est typiquement 1-2 phrases vagues. Le LLM invente les détails.

La One Page contient une section "Core Loop (3 étapes : action → feedback → progression)" qui est précise et validée — mais elle n'est pas passée au GDD (voir Faille #3).

---

## Faille #6 — Aucun garde-fou sur la cohérence entre One Page et GDD

**Symptôme :**
- Le GDD peut contredire, ignorer ou diluer ce qui a été décidé en One Page

**Cause technique :**

Il n'y a aucune étape de validation automatique entre One Page et GDD V1. La critique (`buildGddCritiquePrompt`) analyse le GDD V1 seul, sans comparer à la One Page. Les questions générées ne peuvent donc pas détecter les contradictions avec la One Page.

---

## Résumé des causes racines

| # | Faille | Cause racine |
|---|---|---|
| 1 | Studio context absent du GDD | `buildGddV1Prompt` ne reçoit pas le contexte studio |
| 2 | Univers studio absent partout | Pas de variable de config "studio universe", non passé du brief au GDD |
| 3 | One Page ignorée par le GDD | `scopeSummary` toujours null, One Page non transmise |
| 4 | Sections interdites présentes | Template GDD générique sans exclusions Eden Studio |
| 5 | Core loop floue | Description projet trop vague comme seul input GDD |
| 6 | Pas de cohérence One Page ↔ GDD | Critique ne compare pas GDD vs One Page |

---

## Ce qu'il faudrait corriger (validé)

1. **Ajouter un `studioContext` constant** (univers, contraintes techniques, équipe IA) injecté dans **tous les prompts** — pas seulement GDD, mais aussi One Page, critique, et tout prompt futur
2. **Passer `session.onePage` comme input de `buildGddV1Prompt`** et renseigner `scopeSummary` depuis la One Page
3. **Blacklister les sections** inadaptées (monétisation, portage, playtests humains, équipe humaine) dans le prompt GDD
4. **Ajouter l'univers studio** (Renaissance italienne) dans une config partagée, pas dépendant de ce que l'utilisateur tape

---

## Ordre d'implémentation recommandé

### Étape 1 — Créer `lib/config/studioContext.ts` *(bloquant pour tout le reste)*
Fichier de config exportant une constante `STUDIO_CONTEXT` avec :
- Univers : Renaissance médiévale italienne, université des espions
- Format : mini-jeux web React intégrés via postMessage dans un VN hôte
- Équipe : agents IA uniquement, pas de playtests humains
- Récompenses : à définir quand le VN hôte sera terminé
- Contraintes : web only, pas de monétisation, pas de build natif

### Étape 2 — Injecter `STUDIO_CONTEXT` dans tous les prompts existants
Dans cet ordre (du plus impactant au plus secondaire) :
1. `buildGddV1Prompt` — corrige Failles #1, #2, #4
2. `buildGddV2Prompt` — cohérence avec V1
3. `buildGddCritiquePrompt` — les questions posées seront enfin pertinentes
4. `buildOnePageGeneratePrompt` — déjà partiellement couvert, mais unifier avec la constante

### Étape 3 — Brancher la One Page sur le GDD *(corrige Failles #3 et #5)*
- Renseigner `session.scopeSummary` au moment où l'utilisateur valide la One Page (PATCH `onepage` action `validate`)
- Modifier `buildGddV1Prompt` pour accepter `onePage: string` en plus de `scopeInput`
- Le `scopeInput` devient un fallback uniquement si `onePage` est absent

### Étape 4 — Ajouter la One Page dans `buildGddCritiquePrompt` *(corrige Faille #6)*
- Passer `session.onePage` au prompt de critique
- Ajouter une directive : "Signaler toute contradiction entre le GDD V1 et la One Page validée"

---

## Recommandation sur les LLMs pour rédiger ce type de document

**DeepSeek V3 pour le premier jet technique** — bonne idée. C'est le modèle `tasks` du studio (`deepseek/deepseek-chat-v3-0324`), structuré, précis, bon pour lister des causes racines sans inventer.

**Mistral pour la passe éditoriale** — à nuancer. Le modèle `chat` du studio est `mistralai/mistral-small-creative`, optimisé pour la conversation et la personnalité, pas pour la révision technique. Pour une relecture qui améliore la lisibilité sans toucher au fond, un modèle avec de bonnes capacités rédactionnelles en français serait plus adapté — par exemple `mistralai/mistral-large-latest` ou même Claude Sonnet (disponible sur OpenRouter comme `anthropic/claude-sonnet-4`).

Le pipeline DeepSeek → Mistral Small Creative risque de "coloriser" le contenu technique, d'ajouter du ton conversationnel là où on veut de la rigueur. Recommandation : **DeepSeek V3 draft → Claude Sonnet relecture**, ou simplement garder DeepSeek V3 seul pour les docs techniques — il est déjà lisible.
