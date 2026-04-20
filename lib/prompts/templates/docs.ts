export const GDD_TEMPLATE = `# Game Design Document — {titre}

## 1. Vision du jeu
### Pitch (1 phrase)
### Concept Core (3-5 phrases)
### Références / Inspirations
### Public cible

## 2. Gameplay
### Core Loop (boucle principale)
### Mécaniques principales
### Mécaniques secondaires
### Systèmes de progression

## 3. Univers & Narration
### Setting / Univers
### Personnages principaux
### Arc narratif (si applicable)
### Ambiance / Ton

## 4. Structure du jeu
### Niveaux / Zones / Chapitres
### Durée de vie estimée
### Modes de jeu

## 5. Monétisation (si applicable)
### Modèle économique
### Contenu additionnel prévu

## 6. Contraintes
### Plateforme(s) cible(s)
### Limitations techniques connues
### Budget / Scope`;

export const TECH_SPEC_TEMPLATE = `# Spécification Technique — {titre}

## 1. Stack technique
### Moteur / Framework
### Langage(s)
### Bibliothèques / Dépendances clés
### Outils de build / bundling

## 2. Architecture applicative
### Pattern architectural (ECS, MVC, etc.)
### Structure des dossiers du projet
### Modules / Systèmes principaux

## 3. Systèmes de jeu
### Système de rendu
### Système de physique / collision
### Système d'input
### Système audio
### Système d'UI / menus

## 4. Réseau (si multijoueur)
### Architecture réseau
### Protocole
### Synchronisation d'état

## 5. Performance
### FPS cible par plateforme
### Budget mémoire
### Stratégie d'optimisation

## 6. Build & Déploiement
### Pipeline de build
### CI/CD
### Distribution (stores, itch.io, web...)

## 7. Dépendances externes
### APIs tierces
### Services cloud
### Assets achetés / licenciés`;

export const DATA_ARCH_TEMPLATE = `# Architecture Data & État — {titre}

## 1. Modèle de données
### Entités principales (joueur, ennemis, items, niveaux...)
### Relations entre entités
### Schéma JSON / TypeScript des entités clés

## 2. Gestion d'état
### State manager choisi
### Structure du state global
### Flow de mise à jour d'état

## 3. Persistance
### Système de sauvegarde
### Format de fichier de save
### Données persistées entre sessions

## 4. Assets & Ressources
### Système de chargement d'assets
### Cache / Préchargement
### Format des fichiers de config (JSON, YAML...)

## 5. Événements & Communication
### Système d'événements (pub/sub, signals...)
### Communication inter-modules`;

export const ASSET_LIST_TEMPLATE = `# Asset List — {titre}

## 1. Assets Graphiques
### Sprites / Modèles 3D
| Nom | Type | Taille | Format | Priorité | Notes |
|-----|------|--------|--------|----------|-------|

### Tilesheets / Environnements
| Nom | Type | Taille | Format | Priorité | Notes |
|-----|------|--------|--------|----------|-------|

### UI / HUD
| Nom | Type | Taille | Format | Priorité | Notes |
|-----|------|--------|--------|----------|-------|

### VFX / Particles
| Nom | Type | Format | Priorité | Notes |
|-----|------|--------|----------|-------|

## 2. Assets Audio
### Musique
| Nom | Durée | Format | Contexte | Priorité |
|-----|-------|--------|----------|----------|

### Sound Effects
| Nom | Format | Contexte | Priorité |
|-----|--------|----------|----------|

## 3. Assets Texte / Data
### Dialogues
### Fichiers de configuration
### Traductions (si applicable)

## 4. Récapitulatif
- Total assets graphiques : X
- Total assets audio : X
- Estimation taille totale : X MB`;

export const BACKLOG_TEMPLATE = `# Backlog de Développement — {titre}

## Métadonnées
- Complexité estimée : {simple|moyen|complexe}
- Nombre de waves estimé : {N}
- Durée totale estimée : {durée}

## Items

### [CORE-001] {Titre de l'item}
- **Catégorie** : core-gameplay | system | ui | network | tooling
- **Priorité** : P0 (critique) | P1 (important) | P2 (nice-to-have)
- **Complexité** : S | M | L | XL
- **Département** : programming (UNIQUEMENT — assets visuels en SVG/code, audio procédural ou librairie)
- **Dépend de** : [CORE-XXX, SYS-XXX]
- **Description** : Description détaillée de l'item
- **Critères d'acceptation** :
  - [ ] Critère 1
  - [ ] Critère 2
- **Fichiers impactés** : src/systems/xxx.ts, src/entities/xxx.ts

### [SYS-001] {Titre}
...

## Graphe de dépendances (résumé)
- Wave 1 (aucune dépendance) : CORE-001, SYS-001, SYS-002
- Wave 2 (dépend de wave 1) : CORE-002, CORE-003
- Wave 3 : ...`;

export const README_TEMPLATE = `# {titre}

> {Une phrase qui donne envie d'y jouer — pas une description technique, une promesse.}

---

## C'est quoi ?

{2-3 paragraphes courts qui expliquent le jeu comme si tu le pitchais à un ami curieux.
Pas de jargon. Parle de ce que le joueur VIT, pas de ce que le code fait.
Utilise des comparaisons avec des jeux connus si c'est pertinent.}

---

## Pourquoi tu vas kiffer

{3-4 bullets qui mettent en avant les points forts, le feeling, ce qui rend le jeu unique.
Commence chaque point par un emoji fort.
Parle de sensations, de tension, de satisfaction, pas de systèmes.}

---

## La boucle de jeu

{Décris la boucle de jeu principale en 3-5 étapes simples, comme un mini-guide sans spoiler.
Utilise un format court et rythmé, pas de paragraphes longs.}

---

## Ambiance

{1 paragraphe sur l'univers visuel et sonore. Donne envie d'y être.
Cite des références si besoin (films, jeux, musiques) pour planter le décor.}

---

## Pour qui ?

{1-2 phrases sur le public cible — sans condescendance. "Si tu aimais X, tu vas adorer Y."}

---

## Statut du projet

{Phrase courte sur où en est le développement. Ex: "En développement actif chez AI Game Studio."}`;

