
# Améliorer la qualité des jeux créés

Analyse technique du pipeline actuel et pistes d'amélioration concrètes.

---

## Critique franche du système actuel

**Le pipeline génère des documents, pas des jeux.**

Il produit du markdown cohérent et du code plausible, mais rien ne garantit que ce code tourne, que les systèmes s'intègrent, ou que le jeu est fun. C'est un pipeline de génération de texte habillé en studio de développement.

Problèmes structurels :
- **Pas de runtime** : le code est pushé sur GitHub mais jamais exécuté. On ne sait jamais si ça marche.
- **Le LLM invente une architecture** à chaque projet sans mémoire des projets précédents — les mêmes erreurs se répètent.
- **Le backlog est fictif** : généré par le même LLM qui va l'exécuter, donc il se génère des tâches qu'il sait faire, pas ce que le jeu nécessite.
- **Le GDD est décoratif** : rédigé avant que le moindre système soit testé. Un GDD sans prototype est un roman.
- **Aucune notion de fun** : le pipeline optimise pour "tâches complétées", pas pour "est-ce que quelqu'un voudrait jouer à ça".
- **Les agents sont interchangeables** : en pratique le même modèle joue tous les rôles. La spécialisation est cosmétique.

---

## Problèmes techniques immédiats

### 1. Le coding agent est aveugle sur ses erreurs

**Problème** : Dans `codingAgentService.ts`, l'agent écrit du code et appelle `task_complete` — personne ne vérifie que le code est cohérent. Il peut écrire des imports vers des fichiers inexistants, des fonctions non définies, des types incorrects, et le pipeline continue quand même.

**Pistes** :
- Après chaque `write_file`, demander à l'agent de relire les fichiers qu'il vient d'écrire et vérifier les imports
- Ajouter un outil `check_consistency(files[])` qui liste les symboles exportés vs importés entre fichiers
- Forcer l'agent à appeler `read_file` sur ses dépendances AVANT d'écrire un fichier qui les utilise

---

### 2. Le prompt de tâche dev est trop générique

**Problème** : Dans `buildSystemPrompt` (codingAgentService.ts:128), le système dit juste "développeur expert". Godot (GDScript), Unity (C#), Phaser (TypeScript) ont des conventions radicalement différentes — un prompt générique produit du code qui ne correspond à rien.

**Pistes** :
- Créer un bloc système par moteur : conventions, patterns idiomatiques, structure de fichiers attendue
- Exemple pour Godot : `extends Node`, signaux, `_ready()/_process()`, naming snake_case, scènes/nœuds
- Exemple pour Phaser : classes ES6, `preload/create/update`, groupes, physics bodies
- Injecter ce bloc dans `buildSystemPrompt` selon `project.engine`

---

### 3. Les dépendances de waves sont souvent fausses

**Problème** : `buildDevWavesPrompt` demande des `depends_on_indices` globaux à travers toutes les waves — c'est un format trop complexe. Le LLM produit des indices incorrects (off by one, références à des tâches futures), ce qui casse l'ordre d'exécution.

**Pistes** :
- Remplacer les indices globaux par des références nommées : `depends_on: ["CORE-001", "SYS-002"]`
- Résoudre les dépendances en post-processing via les `backlog_ref` déjà présents dans chaque tâche
- Simplifier : wave N dépend de wave N-1 par défaut, les exceptions sont explicites

---

### 4. Aucun feedback loop sur la qualité du code

**Problème** : Une fois `task_complete` appelé, le code est pushé sur GitHub et la tâche suivante démarre. Si le fichier produit est incohérent avec ceux déjà écrits (mauvais nom de classe, API différente), l'agent suivant part d'une base cassée — et les erreurs s'accumulent en silence.

**Pistes** :
- Après `task_complete`, relire les fichiers pushés et les comparer aux fichiers dépendants déjà présents
- Ajouter une étape de "cohérence inter-fichiers" : l'agent liste ce qu'il a écrit + ce que les autres tâches de la même wave ont produit, et signale les conflits
- Log visible dans l'UI : "3 imports non résolus détectés" plutôt qu'un succès silencieux

---

### 5. Le GDD ne contraint pas assez le code

**Problème** : Le GDD est rédigé en markdown narratif. Quand les tâches de dev sont générées, le GDD est injecté en contexte mais ses mécaniques ne sont pas traduites en contraintes techniques concrètes. L'agent LLM peut les ignorer ou les mal interpréter.

**Pistes** :
- Après validation du GDD, extraire automatiquement un bloc "Contraintes techniques obligatoires" : noms des systèmes principaux, structures de données clés, interfaces entre systèmes
- Ce bloc est injecté dans CHAQUE prompt de tâche de dev, pas juste le GDD complet
- Format court et direct (< 20 lignes) pour ne pas noyer le contexte

---

### 6. Le backlog est généré une seule fois et jamais mis à jour

**Problème** : Le backlog est créé en phase concept et ne change plus. Si le code produit diverge (scope creep de l'agent, décision technique différente), le backlog devient mensonger — les waves suivantes sont générées à partir d'un document obsolète.

**Pistes** :
- Après chaque wave complétée, `generateNextDevWave` compare le travail réalisé au backlog et met à jour les items concernés
- Marquer les items comme "réalisé différemment" si le deliverable path ou la description a changé
- La wave suivante est générée à partir du backlog mis à jour, pas de l'original

---

## Recommandations long terme (choix validés)

### A. Feedback loop code après chaque wave

Au lieu de refondre le point de départ, ajouter une boucle de validation entre chaque wave :
1. Toutes les tâches d'une wave sont complétées
2. Un agent "reviewer" lit l'ensemble du code produit dans cette wave
3. Il identifie les incohérences : imports cassés, interfaces non respectées, noms divergents
4. Il produit un rapport de cohérence visible dans l'UI d'Eden Studio
5. La wave suivante ne démarre que si le rapport est vert (ou si le directeur override)

Ce n'est pas de la CI/CD lourde — c'est un appel LLM structuré après chaque wave, avec le snapshot du repo en contexte.

---

### B. Post-mortem IA après chaque projet

Après qu'un projet est marqué terminé, un agent analyse automatiquement :
- Ce qui était prévu dans le GDD vs ce qui a été réellement implémenté
- Les tâches qui ont divergé (deliverable path différent, description non respectée)
- Les patterns qui ont bien fonctionné (systèmes propres, agents performants)
- Les prompts qui ont produit du code inutilisable

Ce post-mortem met à jour un fichier `studio-memory.md` dans Supabase ou GitHub. Les projets suivants du même genre l'injectent en contexte au moment de la génération des waves.

Concrètement : si le post-mortem du projet Godot détecte que `buildDevWavesPrompt` produit toujours des dépendances incorrectes pour les RPG, le prochain projet RPG Godot démarre avec un prompt corrigé.

---

### C. CI/CD GitHub Actions par projet

Chaque repo de jeu généré reçoit un workflow GitHub Actions minimal adapté au moteur :
- **Godot** : `godot --export` vers un build HTML5, vérification qu'il compile
- **Phaser/web** : `npm run build`, vérification que le bundle sort sans erreur
- **Unity** : build via Unity CLI

Le statut build est remonté dans Eden Studio via l'API GitHub (check runs). L'icône de chaque wave indique si le projet buildait après cette wave. Si un push casse le build, la tâche revient en `failed` automatiquement.

C'est la seule façon d'avoir une vérité objective sur la qualité du code généré.

---

### D. GDD original figé + GDD vivant en parallèle

Le GDD est généré une fois lors du brainstorming et **ne change plus** — c'est le GDD original, la vision initiale.

En parallèle, un `gdd-live.md` est maintenu automatiquement :
- Après chaque wave, un agent compare le code produit au GDD original
- Il met à jour `gdd-live.md` pour refléter ce qui a vraiment été implémenté
- Les divergences sont documentées : `[DÉVIATION] Système de combat simplifié — inventaire non implémenté`

À la fin du projet, on peut comparer les deux GDD et mesurer l'écart entre la vision et la réalité. Ce delta alimente le post-mortem IA (point B) et améliore les prochains brainstormings.

Le GDD original devient aussi un **contrat technique** : après validation, un agent en extrait automatiquement les interfaces principales (noms de systèmes, structures de données, événements) dans un fichier `docs/contracts.ts` injecté dans tous les prompts de dev.

---

## Matrice effort / impact

```
                              IMPACT FORT
                                   │
       ╔══════════════════════════╪════════════════════════════╗
       ║                          │                            ║
       ║  CI/CD GitHub Actions    │   Prompts moteur-          ║
       ║  par projet [C]          │   spécifiques              ║
       ║                          │                            ║
       ║  GDD original +          │   Feedback loop            ║
       ║  GDD vivant [D]          │   wave reviewer [A]        ║
       ║                          │                            ║
       ║  Post-mortem IA          │   Vérification imports     ║
       ║  inter-projets [B]       │   après write_file         ║
       ║                          │                            ║
  EFFORT ──────────────────────┼──────────────────────── EFFORT
  FORT                         │                          FAIBLE
       ║                          │                            ║
       ║  Backlog mis à jour      │   Dépendances par          ║
       ║  après chaque wave       │   backlog_ref (pas indices)║
       ║                          │                            ║
       ╚══════════════════════════╪════════════════════════════╝
                                   │
                             IMPACT FAIBLE
```

---

## Ordre d'implémentation recommandé

1. **Dépendances par backlog_ref** — corrige les cascades d'erreurs dans les waves, changement localisé dans `producerService.ts`
3. **Feedback loop wave reviewer [A]** — premier vrai filet de sécurité qualité
4. **GDD original + GDD vivant + contracts.ts [D]** — aligne le game design et le code de façon structurelle
5. **CI/CD GitHub Actions [C]** — vérité objective sur le build, nécessite des templates par moteur
6. **Post-mortem IA [B]** — capitalisation long terme, utile seulement une fois les autres points en place
