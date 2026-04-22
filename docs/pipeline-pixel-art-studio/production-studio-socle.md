# Fiche d'execution - Ordre 2 - Construire le studio socle vide

## Objectif

Produire et figer deux fonds de reference du meme studio :

- `studio_base_day_v1`
- `studio_base_night_v1`

Ces deux images doivent servir de base stable pour toute la suite du pipeline.

---

## Regle de travail

Pendant cet ordre 2 :

- on ne genere pas de petits objets isoles
- on ne change pas la perspective entre variantes
- on ne change pas la structure generale du lieu
- on compare seulement des bases de studio entre elles

---

## Batch a produire

### Variante 1

- cible : jour
- fichier de brief : `brief-studio-socle-jour.md`
- nombre d'essais : 4
- sortie finale attendue : `studio_base_day_v1`

### Variante 2

- cible : nuit douce
- fichier de brief : `brief-studio-socle-nuit.md`
- nombre d'essais : 4
- sortie finale attendue : `studio_base_night_v1`

---

## Ordre exact d'execution

1. lancer 4 essais pour la version jour
2. eliminer immediatement les rendus qui cassent la lisibilite ou la perspective
3. garder 1 meilleure sortie jour
4. lancer 4 essais pour la version nuit douce
5. comparer la version nuit avec la structure de la version jour
6. garder 1 meilleure sortie nuit
7. geler les 2 images retenues et arreter les regenerations de socle

---

## Grille de selection rapide

Noter chaque essai sur 5 pour chaque critere :

- lisibilite immediate
- coherence de perspective
- credibilite du lieu presque vide
- clarte de la circulation centrale
- qualite du point focal bureau
- compatibilite avec la bible visuelle
- potentiel de reutilisation comme fond

Score guide :

- 5 = tres bon, aucun probleme visible
- 3 = exploitable mais moyen
- 1 = faible ou genant

---

## Conditions de rejet immediat

Rejeter sans noter si :

- la perspective n'est plus stable
- la scene devient trop chargee
- l'image est trop sombre
- le style devient trop detaille ou trop realiste
- le fond parait fini au lieu de rester un socle
- la variante nuit parait etre un autre lieu

---

## Condition de validation finale

L'ordre 2 est considere comme termine seulement si :

- une version jour est retenue
- une version nuit douce est retenue
- les deux paraissent etre le meme lieu
- les deux sont reutilisables sans retouche majeure
- les deux laissent de la place visuelle pour les modules futurs

---

## Ce qu'il ne faut plus faire apres validation

Une fois les 2 bases retenues :

- ne plus regenerer le studio socle pour chaque essai de module
- ne pas corriger la coherence globale en bricolant les prompts d'objets
- ne pas enrichir le fond avec des details qui devraient vivre dans les modules

---

## Etape suivante

Passer a l'ordre 3 avec une liste courte de modules prioritaires, en utilisant le socle jour et nuit comme references fixes.
