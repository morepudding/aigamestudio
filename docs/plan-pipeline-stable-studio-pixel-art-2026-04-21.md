# Plan realiste - Pipeline stable pour un studio pixel art vivant

## Objectif produit

Obtenir un studio de jeux video en pixel art qui :

- a l'air vivant
- reste genere majoritairement par IA
- tourne en local sur un GPU 6 Go de VRAM
- privilegie la stabilite et la coherence plutot que la pure spontaneite
- peut accepter des sacrifices creatifs si cela rend le pipeline fiable

Ce plan assume un usage lent mais stable, y compris en generation nocturne.

---

## Contraintes retenues

Hypotheses confirmees pour ce plan :

- rendu prioritaire : studio vivant d'abord
- execution : local uniquement
- approche preferee : full IA autant que possible
- temps acceptable : long, y compris plusieurs minutes par lot
- livrable attendu : vision produit + architecture, pas de code

---

## Resume executif

Le bon objectif n'est pas de generer chaque objet comme un sprite parfait isole a chaque appel.

Le bon objectif est de construire un pipeline en trois couches :

1. une couche de generation d'ambiance pour le studio global
2. une couche de generation d'objets ou de variantes controlees
3. une couche de normalisation et de validation qui decide ce qui est gardable

Autrement dit :

- l'IA sert a proposer et enrichir
- le pipeline sert a filtrer, normaliser et figer

Le systeme cible doit produire un studio vivant de maniere stable, pas improviser une nouvelle scene complete a chaque micro-demande.

---

## Positionnement recommande

Pour votre objectif, il faut accepter une regle simple :

`full IA` ne doit pas vouloir dire `generation libre a chaque etape`.

Sur 6 Go de VRAM, la strategie la plus realiste est :

- IA forte au moment de creer les bases visuelles
- pipeline rigide au moment de conserver et recombiner ces bases

Le coeur du gain ne viendra pas d'un plus gros modele.

Il viendra d'une meilleure architecture de generation.

---

## Ce qu'il faut viser visuellement

Le resultat cible n'est pas :

- un bureau photorealiste
- un diorama ultra detaille
- une scene differente a chaque rendu

Le resultat cible est :

- une scene lisible en vue isometrique pixel art
- des postes de travail distincts
- quelques signes de vie et de desordre credibles
- une palette et une densite visuelle coherentes
- un decor qui semble habite sans devenir chaotique

Cela implique d'accepter des sacrifices creatifs :

- moins de varietes libres par objet
- plus de reutilisation de bases visuelles
- plus de contraintes de composition
- moins d'objets completement improvises

---

## Architecture cible

## Vue d'ensemble

Le pipeline cible devrait etre separe en cinq etages.

### Etage 1. Generation du studio socle

On genere d'abord un `studio_empty` ou `studio_base` coherent :

- volume de la piece
- sol
- murs
- lumiere globale
- quelques zones structurelles stables

Cette image sert de base de monde, pas d'asset unitaire.

Elle doit etre produite rarement et consideree comme un asset de reference a long terme.

### Etage 2. Generation de modules de scene

Ensuite, on genere des modules d'ambiance reutilisables plutot que des scenes completes :

- poste de travail simple
- coin cafe
- plante
- armoire
- tableau mural
- pile de cartons
- lumiere decorative

Ces modules doivent rester assez contraints en taille et en perspective.

L'idee est de generer des briques de vie, pas un open space entier a chaque fois.

### Etage 3. Generation guidee des variantes

Chaque module important doit pouvoir exister en quelques variantes :

- angle
- couleur dominante
- niveau de desordre
- occupation visuelle

Ces variantes doivent etre creees a partir d'une base deja stabilisee, de preference par refine ou img2img guide, pas par regeneration totalement libre.

### Etage 4. Normalisation automatique

Chaque image generee passe ensuite dans une couche de normalisation :

- detection du sujet principal
- recadrage
- recentrage
- nettoyage du fond
- harmonisation de taille
- verification de la lisibilite isometrique

Cette couche est critique. C'est elle qui transforme un rendu plausible en asset exploitable.

### Etage 5. Validation et gel

Les rendus gardables sont figes dans une bibliotheque locale du projet :

- base studio validee
- modules valides
- variantes valides
- palettes valides

Ensuite, le studio vivant est surtout construit par composition et selection, pas par recreation complete a chaque session.

---

## Pourquoi cette architecture est la bonne pour 6 Go de VRAM

Avec 6 Go, il faut economiser la VRAM sur ce qui apporte le plus de valeur.

Il ne faut pas la depenser a demander au modele de re-decider toute la scene encore et encore.

Cette architecture est adaptee car :

- elle favorise le 512x512 et les workflows compacts
- elle accepte des generations lentes mais unitaires
- elle limite les regenerations inutiles
- elle transforme les bons resultats en assets persistants
- elle reserve la diffusion libre aux etapes ou elle est vraiment utile

En clair : on remplace la force brute par une meilleure reutilisation.

---

## Pipeline recommande en pratique

## Phase A. Construire la bible visuelle du studio

Avant toute optimisation technique, il faut figer un cadre visuel.

Livrables attendus :

- palette dominante du studio
- niveau de detail cible
- type de perspective isometrique
- niveau de desordre acceptable
- materiaux dominants
- regles de lumiere

Sans cette bible, le pipeline va osciller entre trop vide et trop complexe.

Le but n'est pas d'avoir 50 references.

Le but est de definir ce que veut dire chez vous :

- `studio vivant`
- `pixel art lisible`
- `decor charge mais pas brouillon`

---

## Phase B. Stabiliser un studio socle

On commence par produire une ou deux bases de studio fortes :

- studio jour
- studio nuit ou version plus chaude

Ces bases doivent etre generees lentement, avec revue humaine, puis gelees.

Elles deviennent les fonds de reference du pipeline.

Decision importante :

la scene globale ne doit pas etre regeneree a chaque fois qu'on veut ajouter une chaise ou une plante.

Sinon la coherence saute en permanence.

---

## Phase C. Generer des modules de vie plutot que des assets trop abstraits

Dans votre cas, un studio vivant beneficiera plus de modules semi-composes que d'objets trop nus.

Exemples de bons modules :

- bureau avec ecran et accessoires minimum
- coin plante + petite deco
- table basse avec tasses
- mur avec affiche et etagere
- espace pause compact

Exemples de mauvais objets a demander seuls trop tot :

- chaise ultra generique
- petit cable seul
- objet minuscule sans contexte

Pourquoi : un objet ultra isole pousse le modele a reconstituer un contexte implicite. Un module de scene assume deja une micro-composition utile.

Pour un studio vivant, il est souvent plus efficace de controler des micro-scenes que des objets trop atomises.

---

## Phase D. Ajouter une couche d'enrichissement local

Une fois les modules stables, on peut enrichir le studio avec des variations legeres :

- tasse differente
- ecran allume ou eteint
- plante plus grande
- bureau plus range ou plus encombre
- affiches alternatives

Cette couche doit rester conservative.

Elle ne doit pas changer la structure du module.

Elle doit seulement changer l'etat de vie du decor.

---

## Phase E. Composer le studio final

Le studio vivant final doit etre produit par assemblage :

- fond valide
- modules valides
- quelques variantes d'etat
- placement controle
- echelle harmonisee

Le rendu final peut rester tres vivant sans que chaque element soit regene en temps reel.

---

## Ce qu'il faut sacrifier volontairement

Pour obtenir la stabilite, je recommande d'accepter ces sacrifices :

### Sacrifice 1. Moins de generation objet pur

Ne pas chercher a generer chaque petit objet seul en zero-shot.

Il vaut mieux generer des modules plus signifiants.

### Sacrifice 2. Moins de variabilite totale

Une bibliotheque locale de bonnes sorties est une force, pas un echec de l'IA.

### Sacrifice 3. Plus de validation humaine au debut

Au demarrage, il faut assumer une phase de curation plus forte pour construire un stock de bases fiables.

### Sacrifice 4. Plus de lenteur, moins d'improvisation

Puisque vous acceptez les batches de nuit, il faut en profiter pour viser la robustesse au lieu de l'instantane.

---

## Ce qu'il ne faut pas faire

### 1. Regenerer tout le studio trop souvent

Cela casse la coherence et gaspille la VRAM.

### 2. Demander des objets trop conceptuels sans structure

Exemple : `une chaise de bureau stylisee` sans contrainte de forme ni de masse.

### 3. Faire reposer la stabilite uniquement sur le prompt

Le prompt est utile, mais il ne peut pas porter seul toute la discipline de la pipeline.

### 4. Chercher un full IA absolu au niveau du rendu final

Pour un produit stable, la bonne cible n'est pas `100% generation libre`.

La bonne cible est `100% pipeline IA-assiste et controle`.

---

## Plan d'implementation realiste

## Etape 1. Figer la direction artistique exploitable

Objectif : definir les invariants du studio.

Sortie attendue : un mini document de direction visuelle operable.

Critere de succes : deux personnes regardent le rendu cible et comprennent la meme promesse visuelle.

## Etape 2. Produire 2 a 3 studios socles valides

Objectif : creer les fonds principaux du monde.

Sortie attendue : quelques bases stables, reutilisables, propres.

Critere de succes : le studio peut exister visuellement sans regeneration immediate d'objets secondaires.

## Etape 3. Definir une liste courte de modules prioritaires

Objectif : lister les briques qui rendent le studio vivant.

Liste recommandee :

- poste de travail
- zone cafe
- plante decorative
- rangement
- deco murale
- element lumineux

Critere de succes : chaque module ajoute de la vie percue, pas juste de la complexite.

## Etape 4. Mettre en place la normalisation automatique

Objectif : rendre chaque sortie homogène et exploitable.

Sortie attendue : un pipeline de nettoyage, recadrage, recentrage et harmonisation.

Critere de succes : les modules generes semblent appartenir au meme monde.

## Etape 5. Creer une bibliotheque locale des sorties gardees

Objectif : capitaliser sur les bonnes generations.

Sortie attendue : un stock de fonds, modules et variantes approuves.

Critere de succes : la composition finale depend de moins en moins de generations fragiles.

## Etape 6. Composer des scenes vivantes a partir de briques stables

Objectif : produire des studios riches et coherents.

Sortie attendue : une scene finale qui parait animee, habitee et credible.

Critere de succes : l'utilisateur percoit la vie du studio sans remarquer les compromis de pipeline.

---

## Ordre d'implementation concret

Si vous voulez savoir quoi faire dans le bon ordre, il faut suivre cette sequence stricte.

Ne passez pas a l'etape suivante tant que la precedente n'a pas atteint son critere de sortie.

## Ordre reel de travail

### Ordre 1. Definir le format cible avant toute generation

Actions :

- fixer une resolution de travail unique pour les essais, par exemple 512x512
- fixer une perspective cible unique, par exemple isometrique 3/4 legerement surplombee
- fixer une palette directrice courte, par exemple 8 a 16 couleurs dominantes de reference
- fixer 3 mots interdits visuellement, par exemple photorealiste, trop detaille, trop sombre
- fixer 3 promesses visuelles non negociables, par exemple lisible, habite, coherent

Livrable concret :

- un fichier court `style-bible.md` ou equivalent avec ces regles

Critere de sortie :

- vous pouvez decrire le rendu cible en 5 lignes sans hesiter

Pourquoi c'est en premier :

- si ce cadre n'existe pas, tout le reste va diverger et vous ne saurez pas si un rendu est mauvais ou juste different

### Ordre 2. Construire le studio socle vide

Actions :

- generer seulement 2 variantes du studio vide, pas 20
- viser une version jour et une version plus chaude ou soir
- garder la meme camera, la meme echelle et la meme composition generale
- faire une revue manuelle stricte et n'en retenir qu'une ou deux
- geler ces bases comme references et arreter de les regenerer

Livrable concret :

- `studio_base_day`
- `studio_base_warm`

Critere de sortie :

- le fond seul donne deja l'impression d'un vrai lieu de travail, meme sans objets secondaires

Regle importante :

- tant que ces bases ne sont pas stables, il est interdit de travailler les petits objets

### Cas pratique. Si vous avez deja un bon studio socle

Si vous avez deja un `studio_base_day` acceptable ou une base suffisamment solide pour servir de reference, il ne faut pas rester bloque sur l'ordre 2.

Dans ce cas, considerez l'ordre 2 comme provisoirement valide et passez directement a l'ordre 3.

La seule condition est la suivante :

- le socle existant doit etre assez bon pour supporter l'ajout de modules sans que la coherence globale saute immediatement

Si cette condition est remplie, l'ordre reel devient :

1. figer officiellement le studio socle actuel comme reference de travail
2. definir la liste minimale de modules prioritaires
3. produire un seul module pilote
4. ecrire la checklist de normalisation a partir de ce module pilote
5. seulement ensuite etendre la bibliotheque

Autrement dit :

- si le fond est deja bon, il faut arreter de perfectionner le fond et deplacer l'effort vers les modules et la normalisation

### Ordre 3. Definir la liste minimale de modules prioritaires

Actions :

- choisir seulement 5 ou 6 modules qui apportent immediatement de la vie percue
- supprimer tout module trop petit ou trop abstrait
- ecrire pour chaque module sa fonction visuelle dans la scene

Liste de depart recommandee :

- bureau de travail complet
- coin cafe compact
- plante decorative
- rangement ou etagere
- deco murale
- source lumineuse decorative

Livrable concret :

- un tableau simple avec `module`, `role visuel`, `taille relative`, `priorite`

Critere de sortie :

- chaque module choisi change clairement la lecture du studio si on l'ajoute ou si on le retire

### Ordre 4. Produire un seul module pilote de bout en bout

Actions :

- prendre le module le plus rentable visuellement, en general `bureau de travail complet`
- generer plusieurs essais bruts uniquement pour ce module
- choisir 1 sortie acceptable
- normaliser cette sortie
- tester son integration sur le studio socle

Livrable concret :

- 1 module pilote brut
- 1 module pilote normalise
- 1 composition test dans le studio

Critere de sortie :

- vous avez prouve qu'un module peut etre genere, nettoye, stocke et compose sans casser la coherence

Pourquoi c'est critique :

- il ne faut pas industrialiser une pipeline que vous n'avez pas encore validee sur un exemple reel

### Ordre 5. Construire la couche de normalisation avant de faire du volume

Actions :

- definir les operations minimales de post-traitement
- recadrer le sujet
- recentrer le module
- harmoniser la taille apparente
- nettoyer le fond ou le rendre compatible avec la composition
- verifier manuellement la lisibilite a la taille finale

Livrable concret :

- une checklist de normalisation toujours identique
- un dossier ou une convention separee entre `raw` et `approved`

Critere de sortie :

- deux modules issus de generations differentes paraissent appartenir au meme monde apres normalisation

Regle importante :

- si la normalisation n'est pas definie, il ne faut pas lancer de batch massif

### Ordre 6. Etendre progressivement la bibliotheque de modules

Actions :

- produire ensuite les autres modules prioritaires un par un
- limiter chaque module a quelques variantes utiles
- nommer et classer immediatement les sorties gardees
- jeter sans hesitation les variantes moyennes

Cadence recommandee :

- 1 module stabilise avant de passer au suivant
- puis 2 a 3 variantes d'etat maximum par module

Livrable concret :

- une petite bibliotheque locale de modules approuves

Critere de sortie :

- vous pouvez composer une scene convaincante avec repetition legere, sans impression de copier-coller grossier

### Ordre 7. Ajouter les variantes d'etat de vie

Actions :

- enrichir seulement les modules deja stables
- faire varier l'etat, pas la structure
- introduire de petites differences visibles mais sobres

Exemples :

- ecran allume ou eteint
- tasse presente ou absente
- bureau range ou legerement encombre
- plante petite ou moyenne
- affiche A ou B

Livrable concret :

- 2 ou 3 etats par module important

Critere de sortie :

- le studio semble vivant par variation d'etat, sans perdre sa coherence structurelle

### Ordre 8. Composer 3 scenes finales de reference

Actions :

- composer une scene calme
- composer une scene normale
- composer une scene un peu plus chargee
- mesurer visuellement si la scene devient trop vide ou trop brouillonne
- noter les modules qui manquent encore

Livrable concret :

- 3 compositions finales de reference

Critere de sortie :

- vous avez une plage de densite visuelle maitrisable sans regeneration complete du decor

---

## Ce que vous devez faire cette semaine, dans l'ordre

Si vous voulez un ordre immediat, faites uniquement ceci :

### Jour 1

- si la bible visuelle n'est pas terminee, la finaliser
- figer officiellement le meilleur studio socle deja existant
- lui donner un nom de reference stable

### Jour 2

- lister 5 modules prioritaires maximum
- choisir le module pilote
- definir son role exact dans la scene

### Jour 3

- generer seulement le module pilote
- faire 3 a 8 essais, pas plus
- choisir 1 rendu gardable

### Jour 4

- normaliser ce module pilote
- l'integrer dans le studio socle
- verifier si l'echelle, la lisibilite et la coherence tiennent

### Jour 5

- ecrire la checklist de normalisation definitive
- creer l'organisation de bibliotheque locale des sorties retenues

### Jour 6

- produire le deuxieme module
- repasser exactement par la meme pipeline
- verifier que le processus est repetable

### Jour 7

- produire le troisieme module si le deuxieme a confirme la repetabilite
- sinon corriger la normalisation ou le cadrage avant d'elargir

---

## Regles de priorisation pour ne pas se disperser

Quand vous hésitez entre plusieurs choses a faire, appliquez cet ordre de priorite :

1. corriger ce qui casse la coherence globale
2. corriger ce qui empeche la reutilisation d'un asset
3. stabiliser un module deja important visuellement
4. ajouter une variante d'etat
5. seulement ensuite ajouter un nouveau module

Autrement dit :

- coherence avant richesse
- reutilisation avant nouveaute
- pipeline avant inspiration

---

## Definition de termine pour chaque bloc

Une etape est terminee seulement si elle remplit la condition suivante :

- `style-bible` : les regles visuelles sont assez precises pour rejeter un mauvais rendu objectivement
- `studio socle` : le fond peut etre reutilise tel quel dans plusieurs essais
- `module pilote` : il passe de generation a composition sans correction ad hoc imprenable
- `normalisation` : le meme protocole fonctionne sur au moins 2 modules differents
- `bibliotheque` : les assets gardes sont nommes, ranges et selectionnables sans relecture totale
- `scene finale` : la composition semble vivante sans regeneration complete

Si une etape n'atteint pas ce niveau, elle n'est pas finie, meme si elle a produit de belles images.

---

## Risques principaux

## Risque 1. Le studio devient trop statique

Si la bibliotheque est trop petite, le decor semblera fige.

Reponse : multiplier legerement les etats visuels, pas les structures.

## Risque 2. Le studio devient trop brouillon

Si trop de modules sont generes librement, la coherence s'effondre.

Reponse : limiter la generation libre aux nouvelles briques, pas a la scene finale.

## Risque 3. Le pipeline reste trop fragile a la moindre variation

Si chaque prompt doit etre parfait, l'exploitation restera penible.

Reponse : deplacer la stabilite dans la normalisation et dans la bibliotheque validee.

## Risque 4. La contrainte artistique tue le charme

Si on verrouille trop tout, le studio perd son ame.

Reponse : laisser la creativite au niveau des modules et des petits etats de vie, pas au niveau de la structure globale.

---

## Recommandation finale

Pour votre objectif, la meilleure strategie n'est pas :

- generer en boucle des assets unitaires parfaits

La meilleure strategie est :

- figer un studio socle fort
- generer des modules de vie semi-controles
- normaliser agressivement les sorties
- conserver les bonnes generations dans une bibliotheque locale
- composer le rendu final a partir de briques stables

Cette approche respecte vos contraintes :

- elle reste majoritairement IA
- elle est compatible avec 6 Go de VRAM
- elle accepte des traitements lents de nuit
- elle vise un decor vivant plutot qu'une pure demonstration technique

En bref :

pour obtenir un studio pixel art vivant et stable, il faut traiter l'IA comme un atelier de fabrication de briques visuelles, pas comme un peintre qui recompose tout le studio a chaque demande.