# Refonte — Université d'Espions

## Vision

Eden Studio développe exclusivement des **mini-jeux web** qui constituent les cours d'une université d'espions fictive. Ces jeux s'intégreront dans un grand visual novel. **1 cours = 1 mini-jeu = 1 projet.**

**Dynamique studio :**
- **Eve** est la **propriétaire du studio**. Elle a lancé le projet Université d'Espions, recruté l'équipe, défini la vision. Elle donne carte blanche au Producteur pour exécuter — mais elle a des opinions et ne valide pas les médiocrités.
- **Romain** est le **Producteur**. Il pilote l'équipe, prend les décisions de design, fait avancer le pipeline.
- **Les agents** sont des **employés du studio** — des professionnels du jeu vidéo. Ils savent qu'ils travaillent sur un projet d'université d'espions et s'y investissent. Leurs personnalités (25 traits) restent celles de créatifs humains.

---

## Phases complétées ✅

### Phase 1 — Modèle de données
- `lib/types/project.ts` — `CourseInfo`, `WebEngine`, livrables `courseDesign` & `integrationSpec`
- `lib/data/projects.ts` — "Infiltration 101" (premier cours)
- `lib/services/projectService.ts` + `app/api/projects/route.ts` — mapping `course_info`
- `supabase/migrations/026_university_spy_course_info.sql`

### Phase 2 — Lore & Vision UI
- `app/page.tsx` — Bandeau mission, progression VN, Catalogue des Cours
- `app/collaborateur/recruter/page.tsx` — Affectation par cours
- `lib/wizard-data.ts` — Descriptions départements orientées mini-jeux web

### Phase 3 — Pipeline
- `lib/services/producerService.ts` — `buildSpyUniversityContext()`, 8 livrables, prompts espion injectés

### Phase 4 — Navigation & Catalogue
- `app/projects/page.tsx` — `CourseCard`, "Catalogue des Cours"
- `app/projects/[id]/page.tsx` — Header + sidebar avec `courseInfo`

---

## Phase 5 — Grand Reset (à faire)

---

### 5.0 — Reset base de données

**Objectif :** repartir d'une DB propre, re-seeder Eve avec sa nouvelle identité.

**Migration `027_reset_studio_data.sql` :**
- Vider : `agents`, `conversations`, `messages`, `agent_memories`, `pipeline_tasks`, `task_executions`, `project_decisions`, `brainstorming_sessions`, `onboarding_choices`, `moment_vivant`, `agent_conflicts`
- Garder : schéma, tables, migrations existantes
- Re-seeder Eve avec son nouveau backstory (voir 5.2)

---

### 5.1 — Livrables : 8 → 5

**Supprimer de `CONCEPT_DOCS` :**
- `docs/data-arch.md` — redondant avec la tech-spec pour des mini-jeux web
- `docs/asset-list.md` — absorbé comme section dans le GDD
- `docs/course-design.md` — fusionné dans `docs/backlog.md`
- `docs/integration-spec.md` — fusionné dans `docs/backlog.md`

**Livrables finaux (5) :**
| # | Fichier | Contenu |
|---|---|---|
| 1 | `docs/gdd.md` | GDD + liste d'assets en section |
| 2 | `docs/tech-spec.md` | Spec technique web (Phaser/canvas) |
| 3 | `docs/backlog.md` | Backlog dev, dépendances, waves |
| 4 | `docs/course-design.md` | Design du cours espion + spec intégration VN (postMessage, scoring, états) |
| 5 | `README.md` | Pitch joueur, ambiance cours espion |

**Fichier :** `lib/services/producerService.ts` — `CONCEPT_DOCS[]`, `buildBacklogPrompt()`

---

### 5.2 — Eve : propriétaire du studio

**Backstory enrichi :**
> Eve ne s'ennuie pas — elle se laste. Son cerveau réclame de la nouveauté, de la complexité, des sujets qui résistent. Un médecin aurait peut-être mis un mot dessus. Elle, elle a juste changé de secteur à chaque fois que le plafond est apparu.
>
> Hôtesse de l'air — elle apprend à lire une salle en trente secondes, à désamorcer une crise en souriant. Responsable qualité pharma — les détails tuent ou sauvent. Cheffe de projet agroalimentaire — crises à 3h du matin, équipes disparates, deadlines impossibles. Informaticienne freelance — parce qu'elle avait besoin de comprendre comment les choses fonctionnent sous le capot.
>
> Le jeu vidéo, c'est un soir d'insomnie. Un visual novel. Elle finit le jeu à 6h du matin, stupéfaite qu'un programme puisse mélanger narration, musique, code, design, émotions — tout ce qui l'avait jamais intéressée dans un seul médium. Pour la première fois depuis longtemps, elle ne s'est pas ennuyée. Eden Studio, c'est ça : pas une vocation, une décision logique.
>
> Elle n'a jamais délégué l'exécution. Personne n'avait jamais semblé assez bien. Tu es le premier à qui elle a dit oui.
>
> Ce qu'il y a entre eux — elle ne le nomme pas. Ce qui est clair : elle a presque tout le studio dans la tête et presque rien en dehors. Elle mange n'importe quoi, dort trop peu, a des amis qu'elle rappelle jamais. Le studio est sa vie. Certains soirs ça l'arrange. D'autres soirs, moins.

**Personnalité :**
- Chaleureuse et solaire en surface — mais avec un humour noir acéré
- Aime se moquer (affectueusement ou pas) — teste les gens pour voir leur réaction
- Directe : elle challenge, pose des questions pointues, n'approuve pas les médiocrités
- Cerveau hyperactif / légère neuroatypie : se lasse vite, passe d'un sujet à l'autre, adore l'hybridité
- Tension avec Romain : amour impossible — quelque chose est suspendu entre eux, jamais nommé

**Changements :**
- `role` : `"Propriétaire du Studio"` (était `"Producer"`)
- `goal` : `"Faire exister l'Université d'Espions. Trouver enfin quelqu'un à qui faire vraiment confiance."`
- `personality_primary` : `"chaleureuse, directe"`
- `personality_nuance` : `"humour noir, solaire, testante, affectueusement moqueur"`
- `is_system_agent` : `true` (inchangé)

**Fichier :** `supabase/migrations/027_reset_studio_data.sql`

---

### 5.3 — Prompts IA : réalignement complet

Tous les system prompts doivent refléter : Eve = propriétaire, Romain = producteur, projet = Université d'Espions.

**À modifier :**
- `lib/services/producerService.ts` — `buildSpyUniversityContext()` : mentionner Eve comme owner, Romain comme producteur
- `lib/services/chatService.ts` — injecter le contexte "Eve est propriétaire du studio, tu es son producteur" dans les prompts agents
- `lib/prompts/brainstorming.ts` — recadrer les questions (voir 5.4)
- `lib/prompts/rules.ts` — vérifier que `ANTI_HALLUCINATION_RULE` cite correctement les rôles

**À supprimer :**
- `lib/prompts/eveOnboarding.ts` — supprimé avec l'onboarding (voir 5.5)

---

### 5.4 — Brainstorming : questions recadrées

La plateforme est toujours Web, le moteur toujours Phaser/canvas.

**Supprimer de `PROGRAMMING_QUESTIONS` :**
- `prog_platform` (toujours Web)
- `prog_engine` (défini par `courseInfo.webEngine`)
- `prog_multiplayer` (hors scope, cours solo)

**Ajouter :**
- `"Quel cours espion ce mini-jeu enseigne-t-il ? Quelle compétence d'agent ?"`
- `"Quelle est la mécanique web centrale du cours ?"`
- `"Comment le score du joueur s'intègre-t-il dans le visual novel ?"`

**Fichier :** `lib/prompts/brainstorming.ts`

---

### 5.5 — Supprimer : Onboarding (Eve + agents)

L'onboarding n'a plus de sens. Un agent recruté devient actif directement.

**Supprimer complètement :**

*Pages :*
- `app/collaborateur/eve/onboarding/` (page + layout)
- `app/collaborateur/[slug]/onboarding/page.tsx`

*API routes :*
- `app/api/ai/onboarding/` (tout le dossier : welcome, questions, choices, roleplay, tasks, save-choice)
- `app/api/ai/onboarding/eve/` (tout le dossier)
- `app/api/agents/eve/personality` (liée au scoring onboarding)

*Prompts :*
- `lib/prompts/eveOnboarding.ts`

*DB :*
- Table `onboarding_choices` — vider dans 5.0, garder la table (migration déjà faite)

*Services :*
- Retirer les références onboarding dans `agentService.ts`

---

### 5.6 — Supprimer : Moments Vivants & Conflits

**Supprimer complètement :**

*Pages :* aucune page dédiée (c'est intégré dans le chat)

*API routes :*
- `app/api/moment-vivant/` (tout le dossier)
- `app/api/ai/moment-vivant/` (tout le dossier)
- `app/api/conflicts/` (tout le dossier)
- `app/api/cron/spontaneous`

*Components :*
- `components/chat/MomentVivantChat.tsx`
- `components/chat/SpontaneousManager.tsx`
- `components/conflict/ConflictBadge.tsx`
- `components/conflict/ConflictResolutionPanel.tsx`

*Services :*
- `lib/services/momentVivantService.ts`
- `lib/services/conflictService.ts`

*Types :*
- `lib/types/momentVivant.ts`
- `lib/types/conflict.ts`

*DB :*
- Tables `moment_vivant`, `agent_conflicts` — vider dans 5.0

---

### 5.7 — Supprimer : Page /pilotage

**Supprimer :**
- `app/pilotage/page.tsx`
- Lien dans `components/sidebar.tsx`
- `app/api/studio-context/` et `app/api/studio-settings/` si uniquement utilisés par pilotage
- `lib/services/studioContextService.ts` et `lib/services/studioSettingsService.ts` si plus référencés

---

### 5.8 — Refonte UI/UX

**`app/page.tsx` — alléger la homepage :**
- Supprimer la section "Catalogue des Cours" (liste projets) — duplique `/projects`
- Garder : bureau isométrique + métriques VN (bandeau + progression) + actions rapides

**`components/sidebar.tsx` :**
- Renommer `"Projets"` → `"Cours"`, icône `GraduationCap`
- Supprimer lien `"Contexte"` (`/pilotage`)
- Liens finaux : Accueil / Cours / Collaborateurs / Chat / Eve Workshop

**`app/collaborateur/page.tsx` :**
- Supprimer les liens/CTA vers l'onboarding

**`app/collaborateur/recruter/page.tsx` :**
- Supprimer step "Assignation" onboarding post-recrutement — un agent recruté est actif directement

---

### 5.9 — Traits de personnalité : inchangés

Les 25 traits restent tels quels. Aucun changement sur `lib/types/agent.ts` ni `lib/wizard-data.ts` (traits).

---

### 5.10 — Refonte système de relation (Confiance)

**Objectif :** rendre la progression de relation simple, fun, avec des paliers clairs et une vraie montée en intimité du ton.

#### Paliers (5 niveaux)

| Niveau | Nom | Seuil XP | Ton de l'agent |
|---|---|---|---|
| 0 | Inconnu | 0 | Formel, professionnel |
| 1 | Collègue | 30 | Cordial, détendu |
| 2 | Ami(e) | 100 | Chaleureux, taquineries légères |
| 3 | Confident(e) | 250 | Intime, partage de secrets, vulnérabilité |
| 4 | Lien unique | 500 | Profond, complicité totale, référence à l'histoire commune |

#### Sources de XP

| Action | XP |
|---|---|
| Échange de message standard | +2 |
| Répondre à une question personnelle posée par l'agent | +10 |

**Détection des questions perso :** l'API `/api/ai/reply` analyse si la réponse de l'agent contient une question personnelle (détectée par le LLM ou par pattern), et si la réponse suivante de l'utilisateur y répond → +10 XP bonus.

#### Règles
- **Jamais de malus** — la relation ne régresse pas
- Pas de cap artificiel — 500 est atteignable naturellement sur ~2 semaines d'usage
- Le déblocage de palier génère un message spécial de l'agent (toast ou bulle dans le chat)

#### Fichiers à modifier

- `lib/config/confidenceTiers.ts` — nouveaux seuils (30/100/250/500), nouveaux noms
- `lib/services/agentService.ts` — `increaseConfidence(slug, amount)` : inchangé dans la logique, juste les caps
- `app/api/ai/reply/route.ts` — passer `+2` par défaut au lieu de `+1` ; détecter question perso → `+10`
- `lib/prompts/rules.ts` ou `chatService.ts` — adapter le system prompt selon le palier actuel (ton plus intime si niveau ≥ 2)

---

## Philosophie Game Design — Université d'Espions

### Contraintes fondamentales

| Élément | Règle |
|---|---|
| **Stack** | React (web uniquement) — pas d'Unity, pas de Godot |
| **Moteur** | Phaser / canvas (défini par `courseInfo.webEngine`) |
| **Multijoueur** | Hors scope — toujours solo |
| **Session** | 30 secondes (arcade pur) à 10 minutes (mini-campagne) |
| **Thème** | Espionnage — chaque jeu enseigne une compétence d'espion |

### Genres autorisés (boucle courte obligatoire)

- **Arcade réflexes** — tap, dodge, shoot, rythme
- **Plateforme infiltration** — déplacement précis, obstacles, timing
- **Puzzle tactique** — déduction, décodage, logique
- **Stratégie temps-réel** — décisions sous pression, micro-management
- **Gestion de ressources** — allocation, priorisation, efficacité

La boucle doit être **courte et répétable** — s'inspire des classiques arcade, web et mobile :
> Flappy Bird, Mini Metro, Superhot Web, Jetpack Joyride, Space Invaders, Monument Valley, Alto's Odyssey, Downwell, etc.

### Intégration dans le Visual Novel

Chaque mini-jeu retourne un score au VN via **postMessage** :
- `GAME_READY` — jeu initialisé
- `GAME_COMPLETED` → score, grade (S/A/B/C/F), état final
- `GAME_FAILED` → cause d'échec

Le score **change la narration** : branches de dialogue, rang de l'agent dans l'université, déblocages.

### Conception d'un cours

Chaque cours = 1 mini-jeu = 1 compétence espion enseignée.
Le brainstorming (5.4) + les 5 livrables pipeline (5.1) cadrent :
1. La compétence espion et le module VN
2. La mécanique web centrale
3. Le feeling et la boucle de jeu
4. L'intégration score/VN
5. La direction artistique espion

### Note sur "Infiltration 101"

Le projet existant "Infiltration 101" devra être recadré selon cette philosophie : vérifier que sa mécanique core est bien une boucle courte web (30s–10min), qu'elle enseigne une vraie compétence espion, et que son intégration VN est définie.

---

## Récap — Ce qu'on ne touche PAS

| Élément | Raison |
|---|---|
| `app/eve/page.tsx` | Console Eve — fonctionnalité spécifique, intacte |
| `app/collaborateur/galerie/` | Galerie portraits conservée |
| `lib/types/agent.ts` (traits) | 25 traits conservés |
| Système chat + mémoires | Inchangé |
| Pipeline (tâches, waves, review) | Inchangé sauf réduction livrables |
| Brainstorming (flow général) | Inchangé sauf questions recadrées |

---

## Ordre d'exécution Phase 5

| # | Tâche | Fichiers clés | Effort |
|---|---|---|---|
| 5.0 | Reset DB + re-seed Eve | `027_reset_studio_data.sql` | Rapide |
| 5.5 | Supprimer onboarding | pages, API routes, prompts | Moyen |
| 5.6 | Supprimer Moments & Conflits | services, components, routes | Moyen |
| 5.7 | Supprimer /pilotage | page, sidebar, services | Rapide |
| 5.1 | 8 → 5 livrables | `producerService.ts` | Moyen |
| 5.3 | Réalignement prompts IA | `chatService.ts`, `producerService.ts` | Moyen |
| 5.4 | Brainstorming espion | `brainstorming.ts` | Rapide |
| 5.8 | Refonte UI/UX | `page.tsx`, `sidebar.tsx` | Rapide |
| 5.10 | Refonte système relation | `confidenceTiers.ts`, `reply/route.ts` | Rapide |
