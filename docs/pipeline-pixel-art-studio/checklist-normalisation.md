# Checklist - Normalisation des modules

## But

Appliquer toujours le meme protocole apres generation brute.
Le but n'est pas de sauver toutes les sorties.
Le but est d'identifier rapidement celles qui peuvent rejoindre la bibliotheque.

---

## Etapes minimales

### 1. Selection brute

- rejeter les sorties manifestement hors style
- rejeter les sorties illisibles ou trop detaillees
- garder seulement 1 a 2 candidats maximum

### 2. Sujet principal

- verifier que le module est clairement identifiable
- verifier qu'il n'y a pas d'objet parasite qui prend le dessus

### 3. Cadrage

- recadrer pour donner une place lisible au module
- eviter le vide inutile autour
- eviter aussi de couper la silhouette principale

### 4. Recentrage

- recentrer le module de facon stable
- garder une logique similaire entre modules de meme famille

### 5. Taille apparente

- verifier que le module n'est ni trop grand ni trop petit par rapport au studio socle
- comparer directement au socle et aux autres modules deja valides

### 6. Fond et integration

- nettoyer le fond si necessaire
- supprimer les residus visuels inutiles
- verifier que le module peut se poser dans le studio sans bruit visuel parasite

### 7. Lisibilite finale

- verifier la lecture a la taille finale d'usage
- verifier que le module reste compréhensible sans zoom

---

## Questions de validation

Avant d'approuver un module, verifier :

1. est-ce que le module est identifiable en un coup d'oeil ?
2. est-ce qu'il appartient visuellement au meme monde que le socle ?
3. est-ce qu'il respecte la palette et le niveau de detail ?
4. est-ce qu'il garde une echelle credible ?
5. est-ce qu'il peut etre reutilise sans correction ad hoc speciale ?

---

## Statuts recommandes

- `raw` : sortie brute non validee
- `candidate` : sortie retenue pour normalisation
- `approved` : sortie validee pour la bibliotheque
- `rejected` : sortie a ne pas reutiliser

---

## Definition de termine

La normalisation est consideree comme fiable seulement si le meme protocole fonctionne sur au moins deux modules differents sans bricolage exceptionnel.

Etat actuel :

- valide sur `desk_workstation`, variante 1, attempt 1 -> `approved`
- valide sur `plant_green_1`, variante 1, attempt 1 -> `approved`
- convention effective : `raw` pour les sorties brutes, `approved` pour les sorties normalisees retenues
