# Brief exact - Studio socle vide - Version jour

## Statut

Brief de generation pour la premiere base visuelle du pipeline.
Cette version sert a produire un studio socle vide, stable et reutilisable.

---

## Role du rendu

Ce rendu n'est pas une scene finale.
Ce n'est pas non plus une image riche en accessoires.

Ce rendu doit servir de fond de reference pour les compositions futures.

Il doit donc :

- etre lisible immediatement
- rester tres vide mais credible
- installer une ambiance chaleureuse et propre
- laisser de la place pour ajouter ensuite des modules

---

## Decisions verrouillees

### Format

- resolution de travail : 512x512
- cadrage : scene complete lisible en un seul plan
- vue : isometrique 3/4 legerement surplombee

### Ambiance

- version cible : jour
- lumiere principale : grande lumiere laterale venant d'une fenetre hors champ
- atmosphere : chaude, cosy, stable, calme

### Type de piece

- open space compact et lisible
- profondeur moderee
- composition simple, sans architecture complexe

### Point focal

- la zone bureau principale doit etre le point focal du rendu

### Zones structurelles visibles

- zone bureaux
- circulation centrale claire
- mur deco lisible
- coin lumiere identifiable

### Materiaux dominants

- bois clair
- metal doux
- verre discret

### Densite et desordre

- densite faible a aeree
- tres propre quasi minimal
- quelques signes de vie seulement, pas de desordre installe

---

## Ce que le rendu doit montrer

Le studio doit ressembler a un vrai lieu de travail de jeu video en pixel art, mais dans un etat encore presque vide.

Elements attendus :

- un ou plusieurs postes de travail suggeres clairement
- une circulation centrale simple et lisible
- un mur principal qui pourra accueillir de la deco plus tard
- une source de lumiere chaude perceptible dans l'image
- un mobilier de base tres sobre

Elements de vie autorises en quantite minimale :

- un ecran allume ou en veille
- une plante discrete
- une tasse ou un petit objet de bureau isole

Le but est de faire sentir que le lieu existe deja, sans le remplir trop tot.

---

## Ce que le rendu ne doit pas montrer

Interdits generaux :

- photorealiste
- trop detaille
- trop sombre

Interdits specifiques au studio socle vide :

- pas de personnages
- pas d'objets decoratifs nombreux
- pas de cables visibles partout
- pas de bazar sur les bureaux
- pas de neon agressif
- pas de perspective dramatique
- pas de composition surchargee
- pas de coin pause richement meuble
- pas de posters ou accessoires trop nombreux

---

## Brief de generation principal

Utiliser ce texte comme base de generation :

> studio de developpement de jeux video en pixel art, vue isometrique 3/4 legerement surplombee, open space compact et lisible, studio socle vide, ambiance jour chaleureuse, grande lumiere laterale provenant d'une fenetre hors champ, zone bureau principale comme point focal, circulation centrale claire, mur principal simple et propre, coin lumiere discret, mobilier de base sobre, bois clair, metal doux, verre discret, palette chaude cosy creme ambre vert doux, scene lisible, aeree, propre, credible, quelques signes de vie tres limites, pixel art coherent, composition stable, fond de reference reutilisable

---

## Version courte si le modele reagit mieux a des prompts compacts

> pixel art game studio base scene, isometric 3/4 view, compact open space, warm daylight from side window off-screen, clean main work area as focal point, clear central walkway, simple wall, minimal furniture, light wood, soft metal, subtle glass, warm cozy palette, airy composition, very clean but lived-in, no characters, no clutter, reusable base scene

---

## Contraintes negatives a injecter si necessaire

> no characters, no crowded props, no messy desks, no heavy cables, no aggressive neon, no photorealism, no over-detailed textures, no dark moody lighting, no dramatic perspective, no chaotic composition, no dense decoration, no busy background

---

## Critere d'acceptation

Garder un rendu seulement si :

1. la lecture generale est immediate
2. la vue reste clairement compatible avec l'isometrique 3/4 choisie
3. la zone bureau principale attire l'oeil sans saturer l'image
4. la circulation centrale reste visible
5. l'ambiance jour chaude est evidente sans virer a l'orange excessif
6. le studio semble credible meme presque vide
7. le rendu laisse de la place mentale et visuelle pour ajouter des modules ensuite
8. l'image parait stable et reutilisable comme fond

---

## Raisons de rejet

Rejeter sans hesiter si :

- le rendu est joli mais trop charge
- la piece est confuse ou peu lisible
- la perspective varie trop
- le style devient trop realiste ou trop detaille
- les bureaux paraissent deja finis et remplis
- le rendu raconte deja trop de choses alors qu'il doit rester un socle

---

## Cadence recommandee

- produire 3 a 6 essais maximum
- comparer les sorties cote a cote
- en retenir 1 ou 2 maximum
- geler la meilleure comme base de reference

---

## Etape suivante apres validation

Une fois ce studio socle valide, passer au module pilote `bureau de travail complet` sans regenerer le fond a chaque essai.
