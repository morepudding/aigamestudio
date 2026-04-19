# Plan d'implementation performance app

## Objectif

Stabiliser les performances de l'application pour que la navigation soit rapide, lisible et previsible sur desktop comme sur mobile.

Le but est de corriger cinq problemes actuels :

- Les pages principales reposent trop sur le rendu client avec fetch apres montage.
- La navigation App Router ne dispose pas d'etats `loading.tsx` pour masquer la latence.
- Des composants globaux continuent a faire du polling meme hors des ecrans qui en ont besoin.
- Le hub chat charge plus de donnees que necessaire pour un simple apercu.
- La strategie de cache et de chargement progressif n'est pas assez explicite.

## Decision de modelisation

La navigation doit s'appuyer d'abord sur le rendu serveur pour les donnees de lecture.

Les pages liste et consultation doivent afficher leur contenu principal depuis le serveur, puis deleguer uniquement l'interaction locale aux composants client.

Elles doivent contenir :

- un shell de page leger et immediat
- les donnees critiques prechargees cote serveur
- des ilots client limites aux actions interactives
- des etats de chargement explicites pour les transitions
- des composants globaux montes seulement quand ils apportent une vraie valeur

Elles ne doivent pas dependre d'un enchainement : charger la route, hydrater tout le JS, lancer les fetchs, puis enfin afficher le contenu utile.

En consequence, les pages `Projects`, `Chat` et `Collaborateur` doivent etre traitees comme des surfaces de lecture d'abord, et non comme des SPA client integrales.

## Ordre d'implementation recommande

### 1. Formaliser le contrat de rendu

Definir explicitement quelles surfaces doivent etre rendues cote serveur, lesquelles restent clientes, et lesquelles peuvent etre differees.

Objectif : fixer le contrat de performance avant de modifier les composants.

Resultat attendu :

- les pages liste deviennent server-first
- les interactions locales restent dans de petits composants client
- le layout global ne force pas inutilement toute l'app en logique client

### 2. Ajouter les etats de chargement App Router

Creer des `loading.tsx` pour les surfaces les plus frequentes, notamment [app/projects/page.tsx](/Applications/Romain/aigamestudio/app/projects/page.tsx), [app/chat/page.tsx](/Applications/Romain/aigamestudio/app/chat/page.tsx) et [app/collaborateur/page.tsx](/Applications/Romain/aigamestudio/app/collaborateur/page.tsx).

Objectif : rendre la transition immediate meme quand la donnee n'est pas encore arrivee.

Resultat attendu :

- changement de page visuellement instantane
- perception de fluidite meilleure sur mobile et reseau moyen
- reduction de l'effet "page vide puis pop-in"

### 3. Convertir les pages liste en rendu serveur

Faire evoluer [app/projects/page.tsx](/Applications/Romain/aigamestudio/app/projects/page.tsx), [app/chat/page.tsx](/Applications/Romain/aigamestudio/app/chat/page.tsx) et [app/collaborateur/page.tsx](/Applications/Romain/aigamestudio/app/collaborateur/page.tsx) pour charger leurs donnees principales avant rendu.

Le principe utile :

- les listes et metadonnees viennent du serveur
- les modales, boutons et actions restent clientes
- les composants clients recoivent des props deja hydratees

Objectif : eviter la double attente hydrate puis fetch.

### 4. Reduire le travail global hors ecran

Revoir [components/sidebar.tsx](/Applications/Romain/aigamestudio/components/sidebar.tsx), [components/chat/ChatPanelProvider.tsx](/Applications/Romain/aigamestudio/components/chat/ChatPanelProvider.tsx) et [components/chat/ChatPanel.tsx](/Applications/Romain/aigamestudio/components/chat/ChatPanel.tsx).

Le minimum utile :

- diminuer ou supprimer le polling permanent
- ne charger le panel chat que lorsqu'il est ouvert ou demande
- eviter les requetes globales redondantes sur chaque navigation

Objectif : liberer du CPU, du reseau et du temps d'hydratation sur toutes les pages.

### 5. Rendre le hub chat frugal

Revoir [lib/services/chatService.ts](/Applications/Romain/aigamestudio/lib/services/chatService.ts) pour que la vue hub ne charge pas toutes les conversations avec tous les messages.

La vue liste doit idealement recuperer seulement :

- l'identite de l'agent
- le statut de conversation
- le dernier message
- les compteurs utiles

Objectif : ne plus payer le cout complet de l'historique pour afficher un simple resume.

### 6. Ajouter une strategie de cache explicite

Verifier les routes [app/api/agents/route.ts](/Applications/Romain/aigamestudio/app/api/agents/route.ts), [app/api/projects/route.ts](/Applications/Romain/aigamestudio/app/api/projects/route.ts) et les pages qui les consomment.

Le minimum utile :

- utiliser `revalidate` ou une politique de cache adaptee aux listes peu volatiles
- reserver `no-store` aux ecrans vraiment temps reel
- eviter les fetchs client sans raison quand la donnee peut etre resolue cote serveur

Objectif : diminuer la latence reseau et la charge serveur inutile.

### 7. Charger paresseusement les blocs lourds

Introduire du chargement differe pour les composants dont la presence n'est pas critique au premier affichage.

Candidats evidents :

- panel chat global
- sections secondaires riches en animation
- zones de workflow qui ne servent pas a la lecture initiale

Objectif : reduire le JavaScript initial envoye au navigateur.

### 8. Ajouter de l'observabilite legere

Tracer discretement :

- le temps de chargement percu des pages principales
- le nombre de requetes lancees a l'ouverture d'une page
- la taille approximative des donnees chargees par le hub chat
- l'impact du polling avant et apres simplification

Objectif : confirmer que les changements ameliorent la navigation reelle et pas seulement la structure du code.

## Decoupage en lots conseille

### Lot 1 - Navigation immediate

- definir le contrat server-first
- ajouter les `loading.tsx`
- convertir `Projects`, `Chat` et `Collaborateur` en surfaces server-first

### Lot 2 - Reduction du travail inutile

- alleger le layout global
- reduire le polling de la sidebar et du chat panel
- charger le panel chat a la demande

### Lot 3 - Performance de donnees

- rendre le hub chat plus frugal
- poser une vraie strategie de cache
- ajouter les mesures et logs utiles

## Priorites

Ordre de priorite conseille :

1. Passer les pages lentes en rendu serveur
2. Ajouter des `loading.tsx`
3. Reduire le polling global
4. Optimiser le hub chat
5. Poser une strategie de cache puis mesurer

## Resultat cible

A la fin, le systeme doit avoir ces proprietes :

- navigation plus reactive entre les pages principales
- contenu utile visible plus tot
- moins de JavaScript et moins de fetchs au premier affichage
- moins de travail global hors ecran
- meilleur comportement sur mobile et reseau moyen
- base plus simple a optimiser ensuite de facon incrementale