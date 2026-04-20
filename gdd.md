Game Design Document — Version finale
Game Design Document — Cryptographie 101
1. Vision du jeu
Pitch
Un jeu éducatif en 2D où le joueur résout des énigmes cryptographiques pour progresser dans une histoire inspirée de faits historiques.

Concept Core
Mécanique centrale : Décoder des messages via des techniques réelles (César, Vigenère, etc.) avec interface drag-and-drop validée techniquement
Progression : Difficulté croissante avec introduction de nouveaux chiffrements, équilibrage à définir via playtests
Narration : Quête pour déjouer un complot durant la Seconde Guerre mondiale
Récompenses : Documents historiques débloqués (textes <200 mots + illustrations stylisées) après chaque énigme
Références / Inspirations
The Code Book de Simon Singh (inspiration narrative)
Human Resource Machine (pédagogie progressive)
Papers, Please (ambiance historique tense)
Public cible
15-25 ans, joueurs occasionnels et étudiants
Fans d’énigmes ou d’histoire
2. Gameplay
Core Loop
Recevoir un message chiffré
Sélectionner et appliquer une méthode de décryptage via drag-and-drop
Soumettre la solution
Obtenir un feedback narratif + document historique
Mécaniques principales
Système de décryptage :
Interface drag-and-drop pour aligner clefs/alphabets (validée par l'équipe technique)
Feedback visuel immédiat sur la validité des manipulations
Journal de codes : Référence consultable avec exemples interactifs des méthodes apprises
Indices contextuels : Analyse de fréquence dynamique basée sur le contexte narratif
Mécaniques secondaires
Minijeux de reconnaissance de motifs (ex : identifier un drapeau nazi dans un code Morse)
Choix narratifs à impact limité (ex : partager un décryptage influe sur 1-2 dialogues)
Systèmes de progression
Arbre de compétences : Outils débloqués par chapitre (ex : machine Enigma au Chapitre 7)
Gestion des erreurs :
Ralentissement progressif du gameplay après 3 erreurs consécutives
Réinitialisation du rythme après succès
3. Univers & Narration
Setting / Univers
Europe 1942 : bureaux militaires, maisons sûres de la Résistance

Personnages principaux
Lise : Cryptanalyste novice avec arc de progression technique
Klaus : Antagoniste dont les codes deviennent plus complexes
Arc narratif
Acte 1 (Chapitres 1-3) : Décryptage de messages résistants (César, substitution simple)
Acte 2 (Chapitres 4-7) : Infiltration virtuelle avec codes militaires (Vigenère, Enigma)
Acte 3 (Chapitres 8-10) : Décryptage final avec combinaison de techniques
Ambiance / Ton
Sérieux mais accessible :

Archives visuelles en dessins au trait + sépia
Bande-son minimaliste (bruits de machine à écrire, radios)
4. Structure du jeu
Chapitres
10 chapitres = 10 techniques :

Chiffre de César
Substitution simple
Substitution homophonique
...
Combinaison avancée (Enigma + Vigenère)
Durée de vie
Campagne principale : 6-8 heures
Défis chronométrés : +2 heures (hors histoire)
Modes
Campagne : Progression narrative linéaire
Défis : 15 énigmes indépendantes avec classement
5. Monétisation
Modèle
Premium (15-20€) sans microtransactions

DLC "Guerre Froide"
Annulé si ventes < 10 000 unités en 3 mois
Contenu potentiel : One-time pad, chiffrement RSA simplifié
6. Contraintes
Plateformes
PC/Mac (builds Windows et macOS) prioritaire, portage Switch optionnel

Limitations techniques
Codes entièrement scriptés (pas de procédural)
Assets visuels : max 10 Mo par chapitre
Production
Équipe : 5 personnes (1 dev, 1 artiste, 1 designer, 1 historien, 1 sound designer)
Calendrier : 18 mois avec 3 phases de playtests (alpha, bêta, gold)
Équilibrage
Difficulté calibrée via :
Nombre de tentatives moyennes par puzzle lors des playtests
Taux de réussite par groupe d'âge cible
Ajustement des indices contextuels en fonction des retours