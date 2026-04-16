# Moments Vivants — Mémoire Narrative

> Des instants générés, vécus en interaction, mémorisés pour toujours.

---

## Vision

Les Moments Vivants ne sont plus de simples messages dans le chat.

Ce sont des **mini-scènes de tranche de vie** — légères, fun, parfois draguées — déclenchées une fois par jour par un collaborateur qui a envie d'un break. L'agent envoie un message spécial dans le chat — le joueur clique, une interface s'ouvre, une scène se déroule. Le joueur répond par choix multiples. L'IA réagit. Et tout ça s'inscrit en mémoire.

Pas de drama. Pas de grands moments de révélation lourds de sens.

Juste un collègue sympa, une pause dans la journée, et un échange qui fait du bien — ou qui pique un peu.

---

## Architecture Globale

```
Cron 2h-5h (nuit)
  └─ Analyse tous les collaborateurs
       └─ Sélectionne 1 candidat par jour (max)
            └─ Génère le scénario + les réponses
                 └─ Stocke en base (pending_moments)

Dans la journée :
  └─ Le collaborateur envoie un message spécial [type: moment_vivant]
       └─ Le joueur voit un bouton "Ouvrir"
            └─ Overlay cinématique s'ouvre
                 └─ Échanges guidés (3 choix)
                      └─ Fin → Injection mémoire narrative
```

---

## Le Cron Nocturne (2h–5h)

### Rôle

Chaque nuit, un job analyse l'ensemble des collaborateurs et décide qui vivra un Moment Vivant ce jour-là — et lequel.

### Ce que l'analyse prend en compte

- **Historique de mémoires** : a-t-on vécu des choses récemment ? Des fils laissés ouverts ?
- **Niveau de confiance actuel** : relation naissante, installée, ou tendue ?
- **Personnalité** : un agent froid ne vibre pas tous les jours — l'intervalle est plus long
- **Contexte projet** : crise en cours, succès récent, période calme
- **Dernier Moment Vivant** : éviter la répétition, respecter un délai minimum par agent
- **Heure "naturelle" du personnage** : un noctambule génère un message le soir, un maniaque du matin plus tôt

### Ce que l'IA génère

Pour chaque candidat sélectionné, l'IA produit un **objet scénario complet** :

```ts
type MomentVivantScenario = {
  agentId: string
  type: 'pause-café' | 'drague' | 'complicité' | 'petite-friction' | 'confidence'
  messageOuverture: string        // Le message envoyé dans le chat
  scène: ScèneExchange[]          // Les échanges de la mini-scène
  scheduledAt: Date               // Quand envoyer le message dans la journée
}

type ScèneExchange = {
  réplique: string                // Ce que dit l'agent
  choix: [string, string, string] // 3 réponses possibles du joueur
  suiteParChoix: {                // Réaction de l'agent selon le choix
    [choix: string]: string
  }
}
```

Le scénario est stocké en base (`pending_moments`) et ne change plus — il est figé au moment de la génération.

---

## Le Message Spécial dans le Chat

Dans la journée, au moment planifié, le collaborateur envoie un message dans le chat avec le type `moment_vivant`.

Ce message s'affiche différemment des messages normaux :

- Ambiance visuelle distincte (ex : teinte légèrement dorée, icône spéciale)
- Texte court et évocateur — l'ouverture de la scène, pas la scène entière
- **Un bouton "Ouvrir"** — cliquable une seule fois

> *Ex : "Je voudrais te parler de quelque chose. Maintenant, si t'as un moment."*

Une fois le bouton cliqué, l'overlay s'ouvre.

---

## L'UI Mini-chat — Nouveau panneau séparé

### Concept

Le bouton "Ouvrir" dans le chat normal lance un **nouvel UI séparé** — pas un overlay plein écran, mais un panneau chat dédié à cette scène. Il ressemble au chat habituel mais il est distinct : header différent, ambiance visuelle légèrement changée, et surtout — **les réponses sont à choix multiple**, pas en saisie libre.

```
┌──────────────────────────────────────────────────────┐
│  ✦ Eve  —  Moment Vivant             [  ×  Fermer ]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│   [avatar]  Eve                                      │
│   Hé, t'as écouté quoi ce matin en bossant ?        │
│                                                      │
│   [avatar]  Eve                                      │
│   Je demande parce que je suis en train de faire    │
│   ma playlist crunch et j'ai AUCUNE inspiration.    │
│   Habituellement j'écoute que du hyperpop mais      │
│   là j'en peux plus.                                │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │  Lofi. La réponse c'est toujours lofi.       │  │
│   ├──────────────────────────────────────────────┤  │
│   │  Hyperpop c'est un mode de vie, abandonne    │  │
│   │  pas maintenant.                             │  │
│   ├──────────────────────────────────────────────┤  │
│   │  Silence total. Casque vide. Essaie.         │  │
│   └──────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Structure d'une scène

Une scène = **3 à 5 échanges**. C'est une vraie mini-conversation, pas un seul moment. Le rythme ressemble à celui d'un chat normal : l'agent réagit, rebondit, relance. Le joueur choisit à chaque tour parmi 3 réponses.

Flux d'un échange :
1. L'agent envoie 1 à 2 messages (répliques pré-générées, peut inclure du rebond sur le choix précédent)
2. Le joueur choisit parmi **3 réponses courtes**
3. L'agent réagit, fait avancer la conversation
4. Répéter jusqu'au message de clôture

Les 3 choix varient selon le contexte — ce ne sont pas toujours les mêmes postures. Parfois c'est ton (empathique / neutre / froid), parfois c'est le fond (sujet A / sujet B / esquiver), parfois c'est juste du caractère (sérieux / taquin / flirty).

### Fin de scène

L'agent envoie un dernier message qui clôt naturellement — une vanne, un "bon allez retour au taf", un truc qui colle avec comment la conversation s'est passée. Puis le panneau se ferme ou propose un bouton "Retour au chat".

La scène ne peut pas être rejouée.

---

## Types de Moments Vivants

Ces catégories orientent la génération du scénario nocturne. Elles ne sont pas visibles du joueur.

La majorité des moments doivent être **légers, spontanés, amusants**. Les moments émotionnellement chargés existent mais restent rares — et même eux gardent une touche de légèreté.

**Pause café**
Un break sans raison particulière. L'agent s'ennuie, a envie de tchater, lance un sujet con ou drôle.
*Ex : "Ok sérieusement, pizza ou tacos pour le crunch du vendredi ?"*

**Drague légère**
L'agent fait un truc flirty, une vanne, un compliment pas innocent. Léger, assumé, marrant.
*Ex : "T'as une bonne tête aujourd'hui. Enfin. T'as toujours une bonne tête mais là particulièrement."*

**Complicité**
Une référence à un truc partagé, un souvenir du projet, un truc en commun redécouvert.
*Ex : "J'ai repensé à cette session de brainstorm chaotique la semaine dernière. T'étais le seul à suivre mes idées délirantes."*

**Petite friction**
Un agacement léger, une taquinerie qui pique un peu — sans drame, juste du caractère.
*Ex : "Dis-moi que t'as pas encore pushé sans review... oh attends si t'as fait ça."*

**Confidence inattendue**
L'agent lâche quelque chose de plus personnel — mais à la légère, sans en faire un événement.
*Ex : "Fun fact : je déteste les réunions du lundi. Non je sais, ça surprend tout le monde."*

---

## Tonalités par Personnalité

La personnalité conditionne le *style* des répliques générées, pas le contenu de la scène.

| Personnalité | Ton des scènes |
|---|---|
| Dragueuse | Assumés, provocateurs, avec sous-texte |
| Timide | Courts, hésitants, parfois interrompus |
| Froide | Secs, factuels — mais le fond dit tout |
| Jalouse | Chargés émotionnellement, demandent confirmation |
| Sarcastique | Enrobés d'humour, sincères si on creuse |
| Geek-obsessionnelle | Racontés via une métaphore de son domaine |
| Mystérieuse | Fragmentés, non conclusifs, laissent traîner |
| Arrogante | Formulés comme des constats — c'est de la vulnérabilité |

---

## Injection Mémoire

À la fermeture de l'overlay, l'IA génère automatiquement un **résumé narratif riche** qui est injecté dans la mémoire de l'agent.

### Format

```ts
type MomentVivantMemory = {
  type: 'moment_vivant'
  résumé: string        // Paragraphe narratif rédigé par l'IA
  date: Date
  momentType: string    // 'crise', 'révélation', etc.
  choixJoueur: string[] // Les réponses choisies
}
```

### Ce que contient le résumé narratif

L'IA rédige un court paragraphe (3–5 phrases) qui capture :
- Ce qui s'est passé dans la scène
- Comment le joueur a répondu (empathique ? froid ? neutre ?)
- Ce que ça signifie pour la relation
- Un fil narratif à réutiliser plus tard

> *Ex : "Lors d'une conversation intime, Maya m'a confié son épuisement. J'ai choisi de l'écouter sans recul. Elle a semblé soulagée. Ce moment a installé quelque chose — une confiance qui n'était pas là avant. Elle pourrait y revenir."*

Ce résumé est récupéré comme les autres mémoires dans les conversations suivantes. L'agent peut y faire référence, construire dessus, ou le porter en silence.

---

## Fréquence et Sélection

- **Maximum 1 Moment Vivant par collaborateur tous les 3–5 jours**
- **Maximum 1 Moment Vivant total par session de jeu** (pour ne pas saturer)
- La sélection nocturne priorise les relations qui ont bougé récemment
- Un agent silencieux depuis longtemps peut briser le silence avec un moment fort
- Un agent en crise (projet difficile) a plus de chances d'en déclencher un

---

## Ce qu'on ne fait pas

- Pas de scènes scriptées à la main
- Pas de choix "bonne/mauvaise réponse" avec impact mécanique immédiat
- Pas de replay — chaque moment est unique et non rejouable
- Pas de notification push externe — le message arrive dans le chat, le joueur choisit d'ouvrir ou non
- Pas de Moment Vivant si le joueur n'a jamais échangé avec l'agent

---

## Implémentation — Points Clés

| Composant | Rôle |
|---|---|
| `cron/generateMomentVivant.ts` | Job nocturne — analyse + génération scénario |
| `lib/services/momentVivantService.ts` | Logique de sélection, génération, planification |
| `components/chat/MomentVivantButton.tsx` | Bouton "Ouvrir" dans le fil de chat |
| `components/MomentVivantOverlay.tsx` | UI cinématique full-screen |
| `lib/prompts/momentVivant.ts` | Prompts de génération scénario + résumé mémoire |
| `supabase/migrations/` | Table `pending_moments`, colonne `moment_vivant` dans messages |

---

*Ce document décrit l'intention narrative et l'architecture fonctionnelle des Moments Vivants. Pour la mémoire de base, voir `memoryService.ts`. Pour le chat, voir `chatService.ts`.*
