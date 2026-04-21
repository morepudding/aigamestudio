/**
 * Service de validation des spécifications de jeu
 * Vérifie que les documents respectent les contraintes de jeux simples
 */

import { SIMPLE_GAME_CONSTRAINTS, validateSMARTConstraints } from "@/lib/config/gameConstraints";

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100, plus haut = plus simple
  issues: ValidationIssue[];
  suggestions: string[];
  metrics: ValidationMetrics;
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'complexity' | 'scope' | 'technical' | 'smart';
  message: string;
  location?: string;
  suggestion: string;
}

export interface ValidationMetrics {
  wordCount: number;
  mechanicCount: number;
  screenCount: number;
  estimatedDevTime: 'simple' | 'medium' | 'complex';
  simplicityScore: number; // 0-100
}

/**
 * Valide un document GDD/One Page contre les contraintes de jeux simples
 */
export async function validateGameSpec(
  documentType: 'one-page' | 'gdd',
  content: string,
  title: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];
  
  // Analyse basique du contenu
  const wordCount = content.split(/\s+/).length;
  const lines = content.split('\n');
  
  // Détection des mécaniques
  const mechanicKeywords = ['mécanique', 'système', 'feature', 'fonctionnalité', 'gameplay'];
  let mechanicCount = 0;
  lines.forEach(line => {
    if (mechanicKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      // Compter les listes de mécaniques
      if (line.includes('-') || line.includes('*') || line.includes('•')) {
        mechanicCount++;
      }
    }
  });
  
  // Détection des écrans/menus
  const screenKeywords = ['écran', 'menu', 'interface', 'UI', 'HUD'];
  let screenCount = 0;
  lines.forEach(line => {
    if (screenKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      screenCount++;
    }
  });
  
  // Vérification des contraintes quantitatives
  if (mechanicCount > SIMPLE_GAME_CONSTRAINTS.maxCoreMechanics + SIMPLE_GAME_CONSTRAINTS.maxSecondaryMechanics) {
    issues.push({
      severity: 'critical',
      category: 'complexity',
      message: `Trop de mécaniques détectées (${mechanicCount}). Maximum: ${SIMPLE_GAME_CONSTRAINTS.maxCoreMechanics + SIMPLE_GAME_CONSTRAINTS.maxSecondaryMechanics}`,
      suggestion: `Réduisez à ${SIMPLE_GAME_CONSTRAINTS.maxCoreMechanics} mécaniques principales max.`
    });
  }
  
  if (screenCount > SIMPLE_GAME_CONSTRAINTS.maxScreens) {
    issues.push({
      severity: 'warning',
      category: 'scope',
      message: `Trop d'écrans/menus (${screenCount}). Maximum: ${SIMPLE_GAME_CONSTRAINTS.maxScreens}`,
      suggestion: 'Simplifiez l\'interface. 3-5 écrans maximum.'
    });
  }
  
  if (wordCount > 2000) {
    issues.push({
      severity: 'warning',
      category: 'scope',
      message: `Document trop long (${wordCount} mots). Gardez-le concis.`,
      suggestion: 'Résumez à 1000-1500 mots maximum.'
    });
  }
  
  // Vérification de complexité technique
  const complexityIndicators = [
    { term: 'multiplayer', category: 'technical', severity: 'critical' },
    { term: 'online', category: 'technical', severity: 'critical' },
    { term: 'réseau', category: 'technical', severity: 'critical' },
    { term: 'persistant', category: 'technical', severity: 'warning' },
    { term: 'open world', category: 'scope', severity: 'critical' },
    { term: 'monde ouvert', category: 'scope', severity: 'critical' },
    { term: 'procédural', category: 'technical', severity: 'warning' },
    { term: 'IA complexe', category: 'technical', severity: 'warning' },
    { term: '3D', category: 'technical', severity: 'info' },
    { term: 'réalité virtuelle', category: 'technical', severity: 'critical' },
    { term: 'VR', category: 'technical', severity: 'critical' },
    { term: 'AR', category: 'technical', severity: 'critical' },
    { term: 'économique', category: 'scope', severity: 'warning' },
    { term: 'marché', category: 'scope', severity: 'warning' },
    { term: 'crafting', category: 'scope', severity: 'warning' },
  ];
  
  complexityIndicators.forEach(({ term, category, severity }) => {
    if (content.toLowerCase().includes(term.toLowerCase())) {
      issues.push({
        severity: severity as 'critical' | 'warning' | 'info',
        category: category as 'complexity' | 'scope' | 'technical' | 'smart',
        message: `Terme de complexité détecté: "${term}"`,
        suggestion: 'Remplacez par une mécanique plus simple ou supprimez.'
      });
    }
  });
  
  // Vérification des principes SMART
  const smartValidation = validateSMARTConstraints(content);
  smartValidation.issues.forEach(issue => {
    issues.push({
      severity: 'warning',
      category: 'smart',
      message: issue,
      suggestion: 'Appliquez les principes SMART: Spécifique, Mesurable, Atteignable, Réaliste, Temporel.'
    });
  });
  
  smartValidation.suggestions.forEach(suggestion => {
    suggestions.push(suggestion);
  });
  
  // Calcul du score de simplicité (0-100)
  let simplicityScore = 100;
  
  // Pénalités
  if (mechanicCount > 5) simplicityScore -= 30;
  else if (mechanicCount > 3) simplicityScore -= 15;
  
  if (screenCount > 5) simplicityScore -= 20;
  else if (screenCount > 3) simplicityScore -= 10;
  
  if (wordCount > 2000) simplicityScore -= 15;
  else if (wordCount > 1500) simplicityScore -= 5;
  
  // Pénalités pour complexité technique
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const warningIssues = issues.filter(i => i.severity === 'warning').length;
  
  simplicityScore -= criticalIssues * 20;
  simplicityScore -= warningIssues * 5;
  simplicityScore = Math.max(0, simplicityScore);
  
  // Estimation du temps de développement
  let estimatedDevTime: 'simple' | 'medium' | 'complex' = 'simple';
  if (simplicityScore < 60) estimatedDevTime = 'medium';
  if (simplicityScore < 40) estimatedDevTime = 'complex';
  
  const valid = criticalIssues === 0 && simplicityScore >= 60;
  
  return {
    valid,
    score: Math.round(simplicityScore),
    issues,
    suggestions: suggestions.slice(0, 5), // Limiter à 5 suggestions
    metrics: {
      wordCount,
      mechanicCount,
      screenCount,
      estimatedDevTime,
      simplicityScore: Math.round(simplicityScore)
    }
  };
}

/**
 * Génère un rapport de validation lisible
 */
export function generateValidationReport(result: ValidationResult, title: string): string {
  const { valid, score, issues, suggestions, metrics } = result;
  
  let report = `# Rapport de Validation: ${title}\n\n`;
  report += `**Statut:** ${valid ? '✅ VALIDE' : '❌ INVALIDE'}\n`;
  report += `**Score de simplicité:** ${score}/100\n\n`;
  
  report += `## Métriques\n`;
  report += `- Mots: ${metrics.wordCount}\n`;
  report += `- Mécaniques détectées: ${metrics.mechanicCount}\n`;
  report += `- Écrans détectés: ${metrics.screenCount}\n`;
  report += `- Temps de dev estimé: ${metrics.estimatedDevTime}\n\n`;
  
  if (issues.length > 0) {
    report += `## Problèmes détectés\n`;
    
    const critical = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => i.severity === 'warning');
    const infos = issues.filter(i => i.severity === 'info');
    
    if (critical.length > 0) {
      report += `### ❌ Critiques (${critical.length})\n`;
      critical.forEach(issue => {
        report += `- **${issue.message}**\n  → ${issue.suggestion}\n`;
      });
      report += '\n';
    }
    
    if (warnings.length > 0) {
      report += `### ⚠️ Avertissements (${warnings.length})\n`;
      warnings.forEach(issue => {
        report += `- ${issue.message}\n  → ${issue.suggestion}\n`;
      });
      report += '\n';
    }
    
    if (infos.length > 0) {
      report += `### ℹ️ Informations (${infos.length})\n`;
      infos.forEach(issue => {
        report += `- ${issue.message}\n`;
      });
      report += '\n';
    }
  } else {
    report += `## ✅ Aucun problème détecté\n\n`;
  }
  
  if (suggestions.length > 0) {
    report += `## Suggestions d'amélioration\n`;
    suggestions.forEach(suggestion => {
      report += `- ${suggestion}\n`;
    });
    report += '\n';
  }
  
  report += `## Recommandation\n`;
  if (valid) {
    report += `Le document est valide et respecte les contraintes de jeux simples.`;
  } else {
    report += `Corrigez les problèmes critiques avant de continuer.`;
  }
  
  return report;
}

/**
 * Vérifie rapidement si un document semble trop complexe
 */
export function quickComplexityCheck(content: string): boolean {
  // Vérifications rapides
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 2500) return true;
  
  const complexityTerms = [
    'multiplayer', 'online', 'réseau', 'open world', 'monde ouvert',
    'procédural', 'IA complexe', 'réalité virtuelle', 'VR', 'AR',
    'économique', 'marché', 'crafting complexe'
  ];
  
  return complexityTerms.some(term => 
    content.toLowerCase().includes(term.toLowerCase())
  );
}