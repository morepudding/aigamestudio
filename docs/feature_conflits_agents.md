# Feature : Conflits entre Agents

## Vue d'ensemble

Un système de conflits entre agents qui ajoute une couche narrative et émotionnelle au studio management. Les conflits ne bloquent pas le gameplay — leur impact est mémoriel et relationnel. L'agent exprime sa tristesse, sa frustration ou sa rancœur, et ça reste gravé dans ses souvenirs.

---

## Types de conflits

Trois types peuvent exister selon le contexte :

| Type | Description |
|------|-------------|
| **Désaccord créatif/technique** | Deux agents ont des opinions opposées sur une direction projet |
| **Tension relationnelle** | Friction personnelle (jalousie, manque de respect, historique négatif) |
| **Conflit de ressources** | Deux agents se disputent une tâche ou un rôle sur un projet |

---

## Déclenchement

Le conflit est **initié manuellement par le joueur** depuis la fiche d'un agent.

**Flow de déclenchement :**
1. Le joueur ouvre la fiche d'un agent (Agent A)
2. Il clique sur "Créer un conflit" ou "Confronter avec..."
3. Un sélecteur d'agent apparaît — il choisit l'Agent B
4. **L'IA génère 4 scénarios de conflit narratifs** adaptés aux personnalités des deux agents
5. Le joueur choisit l'un des 4 scénarios
6. **L'IA génère les dialogues** d'ouverture du conflit (échange initial entre Agent A et Agent B)
7. Le conflit est créé, les dialogues sont affichés dans le chat de résolution, les deux agents en sont informés via leurs mémoires

### Génération des scénarios narratifs

Quand le joueur clique sur "Créer un conflit", un appel IA est déclenché avec :
- Les personnalités des deux agents (`PersonalityTrait`)
- Leur historique relationnel (mémoires communes)
- Le contexte du studio (projets en cours, département, etc.)

L'IA retourne **4 propositions de scénarios**, chacune avec :
- Un **titre court** (ex: "La jalousie du crédit")
- Une **description narrative** de 1-2 phrases (ex: "Agent A pense qu'Agent B s'est approprié une idée qui n'était pas la sienne lors de la dernière présentation.")
- Le **type de conflit** sous-jacent (`creative_disagreement` / `personal_tension` / `resource_conflict`)

```
┌──────────────────────────────────────────────────┐
│  Choisissez un scénario de conflit               │
│  entre [Agent A] et [Agent B]                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ① La jalousie du crédit                        │
│     Agent A pense qu'Agent B s'est approprié    │
│     une idée lors de la dernière présentation.  │
│                                                  │
│  ② Désaccord sur la direction artistique        │
│     Leurs visions du projet s'opposent           │
│     frontalement depuis la dernière réunion.    │
│                                                  │
│  ③ Tension sur la charge de travail             │
│     Agent A juge qu'Agent B ne fait pas          │
│     sa part sur le projet en cours.             │
│                                                  │
│  ④ Rivalité ancienne ressurgit                  │
│     Un vieux désaccord non résolu refait         │
│     surface dans un moment de stress.           │
│                                                  │
└──────────────────────────────────────────────────┘
```

Une fois le scénario sélectionné, l'IA **génère automatiquement les dialogues d'ouverture** — un échange de 6-10 répliques entre les deux agents qui pose et développe le conflit — avant que le joueur n'intervienne.

---

## Interface utilisateur

### Indicateur de conflit actif

- Un **badge ou icône** apparaît sur la carte de l'agent concerné (ex: ⚡ ou 💢)
- Visible depuis la liste des agents / la vue studio
- Les **deux agents impliqués** affichent l'indicateur

### Onglet de résolution — Chat à deux agents

La résolution se passe dans un **onglet dédié dans l'interface de chat**, avec les **deux agents présents simultanément**.

```
┌──────────────────────────────────────────────────┐
│  ⚡ CONFLIT EN COURS                              │
│  Agent A  ←→  Agent B                            │
├──────────────────────────────────────────────────┤
│                                                  │
│  [Agent A] : "Je ne suis pas d'accord avec       │
│   la direction que tu proposes sur ce projet."   │
│                                                  │
│  [Agent B] : "Tu n'as pas tort mais je pense     │
│   que mon approche est plus solide."             │
│                                                  │
├──────────────────────────────────────────────────┤
│  Choisissez votre position :                     │
│                                                  │
│  [ ] Soutenir Agent A fortement                  │
│  [ ] Soutenir Agent A légèrement                 │
│  [ ] Rester neutre                               │
│  [ ] Soutenir Agent B légèrement                 │
│  [ ] Soutenir Agent B fortement                  │
│                                                  │
│  [Valider ma position]                           │
└──────────────────────────────────────────────────┘
```

---

## Résolution

Le joueur fait des **choix multiples** qui se positionnent sur un **spectre** entre les deux agents.

### Le spectre de décision

```
Agent A ◄────────────────────────────► Agent B
  Fort      Léger    Neutre    Léger     Fort
```

Chaque choix du joueur oriente la résolution vers l'un ou l'autre camp, ou vers un compromis.

### Résultats possibles selon la position finale

| Position | Effet sur Agent A | Effet sur Agent B |
|----------|------------------|------------------|
| Très pro-A | Content, mémoire positive du joueur | Triste/déçu, mémoire négative du joueur |
| Légèrement pro-A | Satisfait | Neutre mais noté |
| Neutre | Mitigé pour les deux | Mitigé pour les deux |
| Légèrement pro-B | Neutre mais noté | Satisfait |
| Très pro-B | Triste/déçu, mémoire négative du joueur | Content, mémoire positive du joueur |

---

## Impact sur les agents

**Pas de malus gameplay direct.** L'impact est exclusivement mémoriel et émotionnel.

- L'agent exprime sa tristesse ou satisfaction via le chat
- La résolution est **enregistrée dans les mémoires** (`agent_memories`) des deux agents
- Cela influence leur ton et leurs réponses dans les conversations futures
- Un conflit ignoré ou mal résolu reste dans la mémoire comme une blessure non guérie

### Exemples de mémoires générées

```
Agent A : "Le joueur a pris mon parti lors du conflit avec [Agent B]. Je me sens soutenu."
Agent B : "Le joueur a choisi le camp de [Agent A]. C'était difficile à accepter."
```

---

## Architecture technique

### Nouveau modèle de données

```typescript
// lib/types/conflict.ts

type ConflictType = 'creative_disagreement' | 'personal_tension' | 'resource_conflict'
type ConflictStatus = 'active' | 'resolved' | 'ignored'

interface AgentConflict {
  id: string
  agentAId: string
  agentBId: string
  type: ConflictType
  status: ConflictStatus
  description: string           // Contexte narratif du conflit
  playerPosition: number        // -2 (pro-A) à +2 (pro-B), null si non résolu
  createdAt: string
  resolvedAt?: string
}
```

### Table Supabase à créer

```sql
create table agent_conflicts (
  id uuid primary key default gen_random_uuid(),
  agent_a_id uuid references agents(id),
  agent_b_id uuid references agents(id),
  type text not null,
  status text not null default 'active',
  description text,
  player_position integer, -- -2 à +2
  created_at timestamp with time zone default now(),
  resolved_at timestamp with time zone
);
```

### Nouveaux endpoints API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/conflicts/scenarios` | POST | Générer 4 scénarios narratifs pour deux agents donnés |
| `/api/conflicts` | POST | Créer un conflit à partir d'un scénario choisi + générer les dialogues d'ouverture |
| `/api/conflicts` | GET | Lister les conflits actifs |
| `/api/conflicts/[id]/resolve` | POST | Résoudre un conflit avec une position |
| `/api/conflicts/[id]/chat` | POST | Envoyer un message dans le chat de résolution |

### Composants UI

- `components/conflict/ConflictBadge.tsx` — indicateur sur la carte agent
- `components/conflict/ConflictResolutionPanel.tsx` — panneau chat à deux agents + spectre de choix
- `components/conflict/ConflictList.tsx` — liste des conflits actifs (optionnel)

---

## Flow complet résumé

```
Joueur ouvre fiche Agent A
         │
         ▼
Choisit "Confronter" → sélectionne Agent B
         │
         ▼
L'IA génère 4 scénarios narratifs adaptés aux deux agents
         │
         ▼
Joueur choisit 1 scénario
         │
         ▼
L'IA génère les dialogues d'ouverture (2-4 répliques)
         │
         ▼
Conflit créé → badge ⚡ sur Agent A et Agent B
         │
         ▼
Joueur ouvre l'onglet de résolution (chat à 2 agents)
         │
         ▼
Les deux IAs dialoguent, joueur fait des choix sur le spectre
         │
         ▼
Position finale enregistrée → mémoires générées pour A et B
         │
         ▼
Badge retiré, conflit marqué "resolved"
         │
         ▼
Impact émotionnel visible dans les prochaines conversations
```

---

## Ce qu'on ne fait PAS (scope limité)

- Pas de malus de performance ou de productivité
- Pas de départ d'agent lié aux conflits
- Pas de propagation aux autres agents
- Pas de conflits auto-générés par l'IA (tout est initié par le joueur)
