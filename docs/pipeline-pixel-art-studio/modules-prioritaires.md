# Tableau - Modules prioritaires

## Regle

Ne garder ici que les modules qui changent vraiment la perception de vie du studio.
Si un element est trop petit, trop abstrait ou trop decoratif, il ne doit pas etre prioritaire.

---

## Ordre de travail recommande

1. bureau de travail complet
2. coin cafe compact
3. plante decorative
4. rangement ou etagere
5. deco murale
6. source lumineuse decorative

---

## Tableau a remplir

| module | role visuel | taille relative | priorite | deja stable ? | variantes de review | notes |
| --- | --- | --- | --- | --- | --- | --- |
| bureau de travail complet | point de vie principal, rend le studio immediatement habite | grand | 1 | oui, pilote valide | `desk_workstation v1`, `desk_workstation v2`, `desk_workstation v3` | bureau retenu en reference, continuer la review sur les autres angles |
| coin cafe compact | ajoute une fonction sociale lisible sans surcharger | moyen | 2 | non | `coffee_machine v1`, `coffee_machine v2`, `water_fountain v1` | proxy de test pour la future fonctionnalite review |
| plante decorative | casse la rigidite du decor, ajoute une respiration visuelle | petit a moyen | 3 | non | `plant_green_1 v1`, `plant_green_2 v1`, `plant_green_3 v1` | la plante verte retenue precedemment est rejetee, repartir sur une nouvelle review |
| rangement ou etagere | donne de la credibilite au lieu | moyen | 4 | non | `cabinet_storage v1`, `cabinet_storage v2`, `cabinet_storage v3` | bon candidat pour tester le swipe sur plusieurs essais |
| deco murale | ajoute de la personnalite sans encombrer le sol | petit a moyen | 5 | non | `poster mural A`, `etagere murale B`, `neon mural C` | variantes planifiees, pas encore branchees dans le generateur |
| source lumineuse decorative | renforce l'ambiance et les etats jour/nuit | petit a moyen | 6 | non | `lampe chaude A`, `lampe froide B`, `enseigne neon C` | variantes planifiees, pas encore branchees dans le generateur |

---

## Regle de validation

Un module reste prioritaire seulement si son retrait rend la scene clairement moins vivante ou moins credible.

---

## Decision immediate

Si vous avez deja un bon studio socle, commencez par `bureau de travail complet` comme module pilote.

Selection actuelle :

- meilleur candidat brut retenu pour `bureau de travail complet` : `desk_workstation`, variante 1, attempt 1
- version normalisee approuvee : `desk_workstation`, variante 1, `approved`
- `plante decorative` sort du lot `approved` et repasse en review brute
- la page dediee de review devient la source de verite pour les decisions `raw`, `approved`, `rejected`
