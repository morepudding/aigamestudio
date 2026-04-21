/**
 * Contraintes pour les jeux simples (2048, Tetris, Pong, Super Mario Bros 1, Age of War)
 * Ces contraintes doivent être appliquées à tous les prompts de génération de spécifications
 */

export interface GameConstraints {
  // Limites quantitatives
  maxCoreMechanics: number; // Nombre maximum de mécaniques principales
  maxSecondaryMechanics: number; // Nombre maximum de mécaniques secondaires
  maxScreens: number; // Nombre maximum d'écrans/menus
  maxGameObjects: number; // Nombre maximum de types d'objets dans le jeu
  maxLevelsOrStages: number; // Nombre maximum de niveaux/étapes
  
  // Complexité technique
  maxSimultaneousSystems: number; // Nombre maximum de systèmes fonctionnant en même temps
  maxInputTypes: number; // Nombre maximum de types d'input (clavier, souris, etc.)
  maxRealTimeUpdates: number; // Nombre maximum de mises à jour en temps réel
  
  // Durée et scope
  maxSessionDurationMinutes: number; // Durée maximum d'une session
  maxDevelopmentComplexity: 'simple' | 'medium' | 'complex'; // Complexité de développement
  targetPlatforms: string[]; // Plateformes cibles
  
  // Exemples de référence
  referenceGames: string[]; // Jeux de référence pour inspiration
}

export const SIMPLE_GAME_CONSTRAINTS: GameConstraints = {
  // Limites quantitatives strictes pour jeux simples
  maxCoreMechanics: 3, // Ex: Tetris = rotation, déplacement, chute
  maxSecondaryMechanics: 2, // Ex: ligne complète, score
  maxScreens: 5, // Menu principal, jeu, pause, game over, high scores
  maxGameObjects: 10, // Ex: Pong = raquettes, balle, murs, score
  maxLevelsOrStages: 20, // Ex: Super Mario Bros 1 = 32 niveaux mais on limite à 20
  
  // Complexité technique minimale
  maxSimultaneousSystems: 3, // Ex: input, physique, rendu
  maxInputTypes: 2, // Ex: clavier (flèches/espace) OU souris
  maxRealTimeUpdates: 2, // Ex: mouvement + collisions
  
  // Durée et scope réalistes
  maxSessionDurationMinutes: 15, // Sessions courtes comme les jeux d'arcade
  maxDevelopmentComplexity: 'simple', // Doit pouvoir être développé rapidement
  targetPlatforms: ['Web'], // Focus sur le web pour l'instant
  
  // Exemples de jeux simples comme référence
  referenceGames: [
    '2048',
    'Tetris',
    'Pong',
    'Super Mario Bros (premier du nom)',
    'Age of War',
    'Snake',
    'Space Invaders',
    'Breakout',
    'Pac-Man',
    'Flappy Bird'
  ]
};

/**
 * Vérifie si une description de jeu respecte les contraintes SMART
 */
export function validateSMARTConstraints(gameDescription: string): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Vérifications basiques
  const words = gameDescription.split(/\s+/).length;
  if (words > 500) {
    issues.push('Description trop longue (>500 mots). Simplifiez.');
    suggestions.push('Limitez à 300 mots maximum.');
  }
  
  // Détection de complexité excessive
  const complexityIndicators = [
    'multiplayer', 'online', 'réseau', 'persistant', 'MMO',
    'open world', 'monde ouvert', 'procédural', 'génération procédurale',
    'IA complexe', 'machine learning', 'réalité virtuelle', 'VR', 'AR',
    'physique avancée', 'moteur 3D', 'graphismes photoréalistes',
    'système économique', 'marché', 'commerce', 'crafting complexe',
    'arbre de compétences', 'progression non-linéaire', 'branchements multiples'
  ];
  
  complexityIndicators.forEach(indicator => {
    if (gameDescription.toLowerCase().includes(indicator.toLowerCase())) {
      issues.push(`Terme de complexité détecté: "${indicator}"`);
      suggestions.push(`Remplacez par une mécanique plus simple.`);
    }
  });
  
  // Vérification des principes SMART
  const smartChecks = {
    specific: ['clairement', 'précis', 'défini', 'concret'],
    measurable: ['mesurable', 'quantifiable', 'score', 'temps', 'niveau'],
    achievable: ['réalisable', 'faisable', 'simple', 'minimal'],
    relevant: ['cohérent', 'pertinent', 'adapté', 'approprié'],
    timeBound: ['session', 'minutes', 'rapide', 'court']
  };
  
  // Suggestions basées sur les principes SMART
  if (!smartChecks.specific.some(word => gameDescription.toLowerCase().includes(word))) {
    suggestions.push('Rendez la description plus spécifique (que fait le joueur exactement?).');
  }
  
  if (!smartChecks.measurable.some(word => gameDescription.toLowerCase().includes(word))) {
    suggestions.push('Ajoutez des éléments mesurables (score, temps, progression).');
  }
  
  if (!smartChecks.achievable.some(word => gameDescription.toLowerCase().includes(word))) {
    suggestions.push('Assurez-vous que le jeu est réalisable avec des ressources limitées.');
  }
  
  const valid = issues.length === 0;
  
  return {
    valid,
    issues,
    suggestions: suggestions.slice(0, 3) // Limiter à 3 suggestions max
  };
}

/**
 * Génère un prompt de contraintes pour les jeux simples
 */
export function buildSimpleGameConstraintsPrompt(): string {
  return `
## CONTRAINTES STRICTES POUR JEUX SIMPLES

Eden Studio se concentre sur des jeux avec une boucle de gameplay simple et efficace, comme :
${SIMPLE_GAME_CONSTRAINTS.referenceGames.map(game => `- ${game}`).join('\n')}

### RÈGLES ABSOLUES :
1. **MAX 3 mécaniques principales** (ex: déplacement, saut, attaque)
2. **MAX 2 mécaniques secondaires** (ex: score, vies, power-ups basiques)
3. **MAX 5 écrans/menus** (menu, jeu, pause, game over, scores)
4. **Sessions de MAX 15 minutes** - jeu d'arcade, pas de marathon
5. **Focus Web uniquement** - pas de mobile/native/console pour V1
6. **Développement simple** - doit pouvoir être codé rapidement

### CE QUI EST INTERDIT :
- Jeux multijoueur en ligne
- Mondes ouverts ou génération procédurale complexe
- IA avancée ou machine learning
- Systèmes économiques complexes
- Graphismes 3D photoréalistes
- Progression non-linéaire avec multiples branches
- Sauvegardes complexes ou données persistantes

### PRINCIPES SMART À SUIVRE :
- **Spécifique** : Décrire exactement ce que le joueur fait
- **Mesurable** : Inclure scores, temps, objectifs clairs
- **Atteignable** : Réalisable avec une petite équipe en peu de temps
- **Réaliste** : Adapté aux contraintes techniques du web
- **Temporel** : Sessions courtes, développement rapide

### EXEMPLE DE BOUCLE SIMPLE (Tetris) :
1. **Action** : Déplacer/faire tourner les pièces
2. **Feedback** : Pièces s'empilent, lignes se complètent
3. **Récompense** : Lignes disparaissent, score augmente
4. **Progression** : Vitesse augmente progressivement

Respectez TOUTES ces contraintes. Si une idée les viole, simplifiez-la radicalement ou proposez une alternative plus simple.
`;
}