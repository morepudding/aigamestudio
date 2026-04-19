# Plan d'implementation memoire agent - complete

## Statut

Document archive comme plan complete.

## Objectif

Stabiliser le systeme de memoire des agents pour qu'il soit coherent, previsible et evolutif.

Le but est de corriger cinq problemes actuels :

- Le flux memoire n'est pas identique entre le ChatPanel et la page chat.
- La consolidation existe dans le code mais n'est pas branchee.
- La deduplication repose trop sur le LLM.
- `topic_tracker` pollue potentiellement la memoire longue.
- La frontiere entre memoire durable et cache conversationnel n'est pas assez claire.

## Decision de modelisation

La table `agent_memory` doit representer la memoire durable.

Elle doit contenir :

- les preferences durables du boss
- les informations personnelles importantes sur le boss
- les informations durables sur la vie de l'agent
- l'etat relationnel utile a moyen et long terme
- les singletons comme `nickname`, `relationship` et `confidence`

Elle ne doit pas devenir un depot de bruit conversationnel recent.

En consequence, `topic_tracker` doit etre traite comme une memoire courte, avec rotation ou expiration, et non comme une memoire permanente qui s'accumule sans limite.

## Ordre d'implementation recommande

### 1. Formaliser les regles de memoire

Definir explicitement la liste des types durables et la liste des types courts.

Objectif : fixer le contrat avant de toucher au pipeline.

Resultat attendu :

- `agent_memory` = memoire durable
- `topic_tracker` = memoire courte
- les types singleton gardent leur comportement actuel

### 2. Unifier le pipeline d'extraction

Faire converger le flux de [components/chat/ChatPanel.tsx](/Applications/Romain/aigamestudio/components/chat/ChatPanel.tsx) et celui de [app/chat/[slug]/page.tsx](/Applications/Romain/aigamestudio/app/chat/[slug]/page.tsx) vers la meme logique d'extraction et de sauvegarde.

Les deux surfaces doivent transmettre les memes donnees :

- `existingMemoriesByType`
- `importance`
- `personalMems`
- `recentTopics`

Objectif : eliminer les differences de comportement selon l'ecran utilise.

### 3. Ajouter une deduplication applicative minimale

Mettre une verification avant insertion dans [lib/services/memoryService.ts](/Applications/Romain/aigamestudio/lib/services/memoryService.ts).

Le minimum utile :

- normaliser le texte avant comparaison
- bloquer les doublons exacts par `agent_slug` + `memory_type` + contenu normalise
- filtrer les quasi-doublons evidents sur les types non-singleton les plus bruyants

Objectif : ne plus dependre exclusivement des instructions donnees au LLM.

### 4. Traiter `topic_tracker` comme memoire courte

Mettre en place une strategie de retention stricte.

Options possibles :

- garder seulement les `N` derniers `topic_tracker` par agent
- supprimer ceux de plus de `X` jours
- remplacer l'accumulation ligne par ligne par un petit bloc recent recompose

Objectif : conserver l'effet anti-repetition sans salir la memoire durable.

### 5. Brancher la consolidation reelle

Utiliser `needsConsolidation` et `replaceMemoriesWithConsolidated` dans [lib/services/memoryService.ts](/Applications/Romain/aigamestudio/lib/services/memoryService.ts#L150) apres les ecritures ou au franchissement d'un seuil.

La consolidation doit s'appliquer uniquement aux memoires durables non-singleton.

Elle ne doit pas integrer la memoire courte.

Objectif : empecher l'accumulation infinie des entrees durables.

### 6. Uniformiser les regles metier entre les surfaces de chat

Verifier que le ChatPanel et la page chat :

- propagent bien `importance`
- utilisent les memes entrees de contexte
- inserent les memoires de la meme facon
- mettent a jour les memoires derivees de la meme maniere

Objectif : avoir un seul comportement memoire, independant du point d'entree UI.

### 7. Ajouter de l'observabilite legere

Tracer discretement :

- le nombre de memoires extraites
- le nombre de memoires rejetees par deduplication
- le nombre de memoires consolidees
- le nombre de `topic_tracker` supprimes par rotation

Objectif : mesurer si le systeme s'ameliorer vraiment avant d'ajuster la frequence ou le prompt.

### 8. Ajuster ensuite le declenchement

Une fois le pipeline fiabilise, reevaluer la regle actuelle d'extraction tous les 5 messages.

Objectif : ne modifier la frequence qu'apres avoir stabilise la qualite du pipeline.

## Decoupage en lots conseille

### Lot 1 - Contrat memoire + unification du flux

- clarifier durable vs court
- unifier ChatPanel et page chat
- propager `existingMemoriesByType`, `importance`, `personalMems`, `recentTopics`

### Lot 2 - Integrite des donnees

- ajouter la deduplication applicative
- mettre en place la rotation ou l'expiration de `topic_tracker`

### Lot 3 - Maintenance de la memoire

- brancher la consolidation
- ajouter les logs et compteurs utiles
- reevaluer ensuite la frequence d'extraction

## Priorites

Ordre de priorite conseille :

1. Unifier le pipeline
2. Ajouter la deduplication applicative
3. Sortir `topic_tracker` de la memoire longue
4. Brancher la consolidation
5. Observer puis ajuster la frequence d'extraction

## Resultat cible

A la fin, le systeme doit avoir ces proprietes :

- meme comportement memoire sur toutes les surfaces de chat
- memoire durable clairement separee du contexte recent
- moins de doublons et moins de bruit
- accumulation bornee dans le temps
- consolidation effective des memoires longues
- base plus simple a faire evoluer ensuite
