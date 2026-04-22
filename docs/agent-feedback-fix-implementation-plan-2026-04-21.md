# Plan d'implementation - Fix conversationnel base sur feedback

Date: 2026-04-21
Sources:
- docs/agent-feedback-analysis-2026-04-21.md
- docs/agent-conversations-feedback-report-2026-04-21.md

## Objectif

Croiser les patterns observes dans les thumbs up et thumbs down avec le code actuel, puis proposer un plan de correction concret, incremental et mesurable.

Le probleme n'est pas uniquement un probleme de prompt general. Une partie du comportement faible vient de fallback et de mecanismes communs deja presents dans le code.

## Diagnostic croise feedback x code

### 1. La repetition systemique a une cause code directe

Constat feedback:

- la phrase `tu t'es pose un peu ou pas encore ?` prend plusieurs thumbs down chez plusieurs agents

Constat code:

- `lib/services/conversationMessageService.ts` contient un fallback de mode `nudge` qui renvoie exactement `tu t'es pose un peu ou pas encore ?`
- ce fallback est appele par `normalizeConversationMessage(...)` des qu'un message de nudge est vide, invalide, pseudo-narratif ou hors contraintes

Conclusion:

- cette phrase n'est pas un accident de generation ponctuel
- c'est une sortie de secours partagee par tout le systeme
- tant que ce fallback existe tel quel, les thumbs down vont continuer a se concentrer dessus

### 2. L'anti-repetition existe, mais il est trop local

Constat feedback:

- les utilisateurs sanctionnent non seulement la repetition dans une meme conversation, mais aussi la repetition transversale entre agents et entre moments proches

Constat code:

- `app/api/ai/reply/route.ts` utilise `buildAntiRepeatBlock(...)`
- ce bloc ne regarde que les 4 dernieres reponses agent de la conversation en cours
- `app/api/ai/nudge/route.ts` n'a pas d'anti-repeat equivalent base sur des messages reellement rejetes
- `app/api/ai/welcome/route.ts` et `app/api/ai/memory-interview/route.ts` restent plus simples et n'exploitent pas d'historique qualitatif

Conclusion:

- le systeme sait eviter la repetition immediate intra-thread
- il ne sait pas eviter les formulations faiblees qui reapparaissent ailleurs ou plus tard

### 3. Le systeme detecte l'ouverture utilisateur, mais pas assez le pivot explicite

Constat feedback:

- Lyra obtient un thumbs down en continuant a parler du cafe alors que l'utilisateur veut changer de sujet
- le thumbs up tombe juste apres quand elle accepte explicitement le pivot

Constat code:

- `lib/services/conversationMessageService.ts` expose `getUserSignalLevel(...)`
- `lib/prompts/conversationCore.ts` adapte deja la reponse selon un signal `low | medium | open`
- mais il n'existe pas encore de detecteur robuste de `topic rejection` ou `topic pivot`
- les prompts disent globalement `reponds d'abord au message`, mais pas `interdit de relancer le theme explicitement refuse`

Conclusion:

- le systeme comprend l'intensite d'ouverture
- il ne comprend pas encore assez fort la consigne implicite `arrete ce sujet`

### 4. La boucle de feedback utilisateur n'est pas reinjectee dans la generation

Constat feedback:

- les thumbs donnent deja un signal exploitable par agent, par type de message et par pattern lexical

Constat code:

- le schema stocke `messages.user_feedback` et `messages.user_feedback_at`
- `chatService.ts` remonte ce champ dans les types
- `chatMetadata.ts` sait tracer la source de generation (`welcome`, `standard_reply`, `memory_interview`, `topic_reservoir`, `seed_nudge`, `fallback`)
- mais les routes de generation ne consultent pas encore les messages likes/dislikes recents pour guider le prompt ou filtrer les fallback

Conclusion:

- la data existe deja
- elle n'alimente pas encore la boucle de generation

### 5. Les seed de nudge sont meilleurs qu'avant, mais encore insuffisamment filtres

Constat feedback:

- les thumbs down frappent surtout les fillers et les relances generiques

Constat code:

- `app/api/ai/nudge/route.ts` a deja une seed bank par personnalite et un `buildNonScenarioSeed(...)`
- il y a deja une regle explicite `Evite completement les relances vides comme "tu fais quoi là ?"`
- mais le fallback final reste non qualifie par feedback, et la generation n'exclut pas encore les formulations historiquement mal notees

Conclusion:

- la direction est bonne
- le dernier filet de securite reste trop faible et annule une partie des gains

## Proposition de fix - plan d'implementation

## Phase 1 - Supprimer les causes code les plus evidentes

Objectif:

- faire disparaitre rapidement les formulations systemiquement sanctionnees
- remplacer les sorties de secours neutres par des sorties de secours deja colorees par personnalite
- supprimer des la premiere phase la sensation de moteur commun derriere plusieurs agents
- le faire sans ajouter une nouvelle couche de fichiers ou de configuration

Changements:

1. Remplacer le fallback nudge hardcode dans `lib/services/conversationMessageService.ts`
2. Reutiliser d'abord les mecanismes deja presents dans `app/api/ai/nudge/route.ts` et `app/api/ai/reply/route.ts` au lieu de creer une nouvelle source de phrases
3. Faire remonter jusqu'a `normalizeConversationMessage(...)` les informations minimales deja disponibles sur l'agent ou la personnalite afin que le fallback ne soit plus seulement pilote par `mode`
4. Quand un `nudge` tombe en fallback, reemployer prioritairement la logique de seed existante par personnalite au lieu d'emettre une phrase generique commune
5. Quand un `reply` tombe en fallback, deriviver une version courte de la voix agent a partir des traits deja exploites par les prompts existants, sans introduire un nouveau fichier de configuration
6. Chaque personnalite doit avoir des contraintes de secours minimales dans les branches existantes:
   - Eve: image concrete + leger decallage + formule propre
   - Kaida: pique courte + tension relationnelle + relance precise
   - Lyra: fantaisie concrete + energie legere + zero filler fatigue/cafe
   - Lysara: logique seche + observation nette + ironie contenue
7. Interdire dans cette phase toute phrase de secours partagee telle quelle entre plusieurs agents
8. Ajouter une blacklist minimale des formulations explicitement rejetees, commencee par:
   - `tu t'es pose un peu ou pas encore ?`
   - `tu fais quoi là ?`
   - variantes proches sur `pause`, `cafe`, `tu t'es pose`, `tu fais quoi`
9. Faire en sorte que `normalizeConversationMessage(...)` n'emette jamais une phrase blacklistée en fallback
10. Ajouter un petit test unitaire ou au minimum un script de validation qui verifie que les fallbacks de plusieurs agents ne se collisionnent pas textuellement

Fichiers cibles:

- `lib/services/conversationMessageService.ts`
- `app/api/ai/nudge/route.ts`
- `app/api/ai/reply/route.ts`
- eventuellement `lib/prompts/conversationCore.ts` si un ajustement minimal de formulation est necessaire

Impact attendu:

- baisse immediate des thumbs down repetitifs
- disparition du pattern le plus evident sans toucher encore aux prompts profonds
- premiere hausse de differenciation percue entre agents meme quand la generation principale echoue
- reduction du risque que Phase 4 doive corriger trop tard des habitudes generiques deja visibles en prod

Note de cadrage:

- la Phase 1 ne doit plus etre vue comme un simple nettoyage technique
- c'est un premier filet produit visible par l'utilisateur
- donc il doit deja proteger deux choses en meme temps: la qualite minimale et la signature agent
- et il doit le faire en reutilisant au maximum les branches existantes de `nudge` et `reply`, pas en ouvrant un sous-systeme de fallback parallele

## Phase 2 - Ajouter un vrai detecteur de pivot et de rejet de sujet

Objectif:

- empecher les agents de poursuivre un theme explicitement refuse par l'utilisateur

Changements:

1. Ajouter dans `lib/services/conversationMessageService.ts` une detection de signaux de rejet de sujet:
   - `on peut arreter de parler de ...`
   - `parlons d'autre chose`
   - `j'en ai marre de ...`
   - `stop avec ...`
2. Exposer un helper du type `detectConversationPivot(...)` qui renvoie:
   - `shouldPivot`
   - `blockedTopics`
   - `pivotStrength`
3. Injecter ce resultat dans:
   - `app/api/ai/reply/route.ts`
   - `app/api/ai/memory-interview/route.ts`
   - `app/api/ai/nudge/route.ts`
4. Ajouter dans le prompt une regle dure:
   - si le user rejette un sujet, le prochain message ne doit pas le relancer

Fichiers cibles:

- `lib/services/conversationMessageService.ts`
- `lib/prompts/conversationCore.ts`
- `app/api/ai/reply/route.ts`
- `app/api/ai/memory-interview/route.ts`
- `app/api/ai/nudge/route.ts`

Impact attendu:

- meilleure ecoute percue
- reduction des thumbs down sur insistance thematique
- gain particulier attendu pour Lyra

## Phase 3 - Rendre l'anti-repeat globalement conscient des mauvais patterns

Objectif:

- sortir d'un anti-repeat purement local et passer a un anti-repeat guide par feedback

Changements:

1. Creer un service type `conversationFeedbackService.ts`
2. Y ajouter des requetes simples pour recuperer:
   - les derniers messages agent thumbs down par agent
   - les derniers messages agent thumbs up par agent
   - les patterns textuels rejetes globalement dans les dernieres 24h ou 7j
3. Construire un bloc de prompt du type:
   - `Evite ce type de formulations recemment mal recues`
   - `Ce qui marche mieux en ce moment: reponses precises, imagee, situees`
4. Injecter ce bloc au moins dans:
   - `app/api/ai/reply/route.ts`
   - `app/api/ai/nudge/route.ts`

Fichiers cibles:

- nouveau `lib/services/conversationFeedbackService.ts`
- `app/api/ai/reply/route.ts`
- `app/api/ai/nudge/route.ts`

Impact attendu:

- baisse de la recurrence des memes formulations faibles
- ajustement plus rapide aux preferences reelles de l'utilisateur

## Phase 4 - Specialiser les nudges et replies par agent sans partager les fillers

Objectif:

- conserver la couleur agent, supprimer les formulations interchangeables

Changements:

1. Formaliser une mini signature conversationnelle par agent ou archetype:
   - Eve: image nette + chute legere + recadrage propre
   - Kaida: pique precise + teasing court + relance ciblee
   - Lyra: fantaisie concrete + pivot rapide + zero insistance
   - Lysara: logique seche + ironie sobre + coherence scenario
2. Brancher cette signature dans les prompts reply et nudge
3. Interdire explicitement les fillers partageables entre toutes les personnalites

Fichiers cibles:

- nouveau `lib/prompts/agentConversationProfiles.ts`
- `app/api/ai/reply/route.ts`
- `app/api/ai/nudge/route.ts`

Impact attendu:

- plus de differenciation utile entre agents
- moins de sensation de moteur commun derriere plusieurs personnages

## Phase 5 - Fermer la boucle produit avec mesure et traces

Objectif:

- verifier que les changements ameliorent vraiment le ratio thumbs up vs thumbs down

Changements:

1. Etendre `chatMetadata.ts` avec des champs optionnels de trace supplementaires:
   - `promptVariant`
   - `fallbackKey`
   - `pivotDetected`
   - `blockedTopics`
2. Faire en sorte que chaque message agent stocke suffisamment de trace pour expliquer sa generation
3. Ajouter un script ou un export analytique simple regroupant:
   - feedback par source (`standard_reply`, `memory_interview`, `seed_nudge`, `fallback`)
   - feedback par agent
   - top patterns rejetes
   - top patterns a succes

Fichiers cibles:

- `lib/services/chatMetadata.ts`
- `docs/` ou `scripts/` pour l'export

Impact attendu:

- iteration plus rapide sur les prompts
- capacite a savoir si le probleme vient du fallback, du nudge, du reply ou du discovery

## Ordre recommande d'execution

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 5 minimaliste
5. Phase 4 en raffinement

Pourquoi cet ordre:

- Phase 1 corrige une cause directe deja prouvee par le feedback
- Phase 2 corrige le deuxieme pattern le plus couteux, le mauvais pivot
- Phase 3 branche enfin la data feedback dans la generation
- Phase 5 permet de mesurer les gains
- Phase 4 est importante, mais moins urgente que la suppression des defauts structurels

## Definition de success

Le plan est considere comme reussi si, sur le prochain echantillon d'usage:

1. la phrase `tu t'es pose un peu ou pas encore ?` disparait completement
2. les thumbs down sur repetition baissent nettement
3. les agents cessent de relancer un theme explicitement rejete
4. le ratio thumbs up / thumbs down s'ameliore sur les nudges
5. la distribution des thumbs up devient plus differenciee par agent, signe que la personnalite est mieux preservee

## Hypothese de ROI

Le meilleur retour court terme viendra probablement de:

1. remplacer le fallback nudge commun
2. ajouter la regle de pivot explicite
3. reutiliser les thumbs down recents comme anti-patterns de prompt

Ce trio devrait corriger une grande partie des defauts visibles sans refonte complete de l'architecture conversationnelle.