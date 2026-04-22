import fs from 'fs';
import path from 'path';

export interface Scenario {
  id: number;
  title: string;
  situation: string;
  action: string;
  subtext: string;
  mood: string;
  themes: string[];
  relationLevel: 1 | 2 | 3;
  personalityRequired?: string[];
  examples: string[];
}

export class TopicReservoirService {
  private scenarios: Scenario[] = [];
  private initialized = false;

  constructor() {
    this.loadScenarios();
  }

  private async loadScenarios(): Promise<void> {
    if (this.initialized) return;

    try {
      const filePath = path.join(process.cwd(), 'docs', 'topic-reservoir.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parser le markdown pour extraire les scénarios
      this.scenarios = this.parseMarkdown(content);
      this.initialized = true;
      console.log(`[TopicReservoir] Loaded ${this.scenarios.length} scenarios`);
    } catch (error) {
      console.error('[TopicReservoir] Failed to load scenarios:', error);
      this.scenarios = [];
    }
  }

  private parseMarkdown(content: string): Scenario[] {
    const scenarios: Scenario[] = [];
    
    // Diviser par les scénarios (commençant par ### X. Titre)
    const scenarioRegex = /### (\d+)\. ([^\n]+)\n([\s\S]*?)(?=### \d+\. |\n## |$)/g;
    let match;
    let scenarioId = 1;
    
    while ((match = scenarioRegex.exec(content)) !== null) {
      const [, number, title, body] = match;
      const scenarioContent = `### ${number}. ${title}\n${body}`;
      
      const scenario: Partial<Scenario> = {
        id: scenarioId++,
        title: title.trim(),
        situation: '',
        action: '',
        subtext: '',
        mood: '',
        themes: [],
        relationLevel: 1,
        examples: [],
      };
      
      // Extraire les champs - format: **Champ** : valeur
      // Mais dans le fichier actuel, c'est: **Champ** : valeur sur la même ligne
      const lines = scenarioContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('**Situation**')) {
          // La valeur est sur la ligne suivante
          if (i + 1 < lines.length) {
            scenario.situation = lines[i + 1].trim();
            i++; // Sauter la ligne de valeur
          }
        } else if (line.startsWith('**Action**')) {
          if (i + 1 < lines.length) {
            scenario.action = lines[i + 1].trim();
            i++;
          }
        } else if (line.startsWith('**Sous-texte**')) {
          if (i + 1 < lines.length) {
            scenario.subtext = lines[i + 1].trim();
            i++;
          }
        } else if (line.startsWith('**Mood**')) {
          if (i + 1 < lines.length) {
            scenario.mood = lines[i + 1].trim();
            i++;
          }
        } else if (line.startsWith('**Thèmes**')) {
          if (i + 1 < lines.length) {
            const themesText = lines[i + 1].trim();
            scenario.themes = themesText.split(',').map(t => t.trim().replace(/`/g, ''));
            i++;
          }
        } else if (line.startsWith('**Niveau relation**')) {
          if (i + 1 < lines.length) {
            const levelText = lines[i + 1].trim();
            const levelMatch = levelText.match(/`(\d)`/);
            if (levelMatch) {
              scenario.relationLevel = parseInt(levelMatch[1]) as 1 | 2 | 3;
            }
            i++;
          }
        } else if (line.startsWith('**Personnalité requis**')) {
          if (i + 1 < lines.length) {
            const personalityText = lines[i + 1].trim();
            if (personalityText && personalityText !== ':') {
              scenario.personalityRequired = personalityText.split(',').map(p => p.trim().replace(/`/g, ''));
            }
            i++;
          }
        } else if (line.startsWith('**Exemples**')) {
          // Collecter les exemples des lignes suivantes
          const examples: string[] = [];
          for (let j = i + 1; j < lines.length; j++) {
            const exampleLine = lines[j].trim();
            if (exampleLine.startsWith('- ')) {
              examples.push(exampleLine.replace('- ', '').trim());
            } else if (exampleLine && !exampleLine.startsWith('**')) {
              // Continuer si c'est une continuation d'exemple
              if (examples.length > 0) {
                examples[examples.length - 1] += ' ' + exampleLine;
              }
            } else {
              break;
            }
          }
          scenario.examples = examples;
          i += examples.length; // Sauter les lignes d'exemples
        }
      }
      
      // S'assurer que tous les champs requis sont remplis
      if (scenario.situation && scenario.action && (scenario.examples?.length ?? 0) > 0) {
        scenarios.push(scenario as Scenario);
      }
    }
    
    return scenarios;
  }

  private getRelationLevelFromConfidence(confidenceLevel: number): 1 | 2 | 3 {
    if (confidenceLevel < 30) return 1; // Inconnu
    if (confidenceLevel < 100) return 2; // Collègue
    return 3; // Ami/Confident
  }

  private mapPersonalityToTraits(personalityPrimary: string): string[] {
    const mapping: Record<string, string[]> = {
      dragueuse: ['charmeur', 'expressif', 'flirt'],
      expressive: ['expressif', 'attentif'],
      impulsive: ['impulsif', 'expressif'],
      timide: ['attentif'],
      charmeur: ['charmeur', 'expressif'],
      attentif: ['attentif'],
      'réservé': ['attentif'],
      reserve: ['attentif'],
      taquin: ['expressif', 'taquin'],
      sarcastique: ['taquin', 'expressif'],
      admirative: ['attentif', 'expressif'],
      provocatrice: ['taquin', 'expressif', 'flirt'],
      chaleureuse: ['attentif', 'expressif'],
      directe: ['expressif'],
      solaire: ['expressif'],
      testante: ['taquin'],
      soumise: ['attentif'],
      manipulatrice: ['taquin'],
    };

    const tokens = personalityPrimary
      .toLowerCase()
      .split(/[,+/]/)
      .map((token) => token.trim())
      .filter(Boolean);

    const traits = new Set<string>();
    for (const token of tokens) {
      const mappedTraits = mapping[token] ?? [];
      for (const trait of mappedTraits) {
        traits.add(trait);
      }
    }

    return [...traits];
  }

  private personalityMatchesRequirements(
    agentTraits: string[],
    requiredTraits?: string[]
  ): boolean {
    if (!requiredTraits || requiredTraits.length === 0) {
      return true;
    }
    
    return requiredTraits.some(trait => 
      agentTraits.some(agentTrait => 
        agentTrait.toLowerCase().includes(trait.toLowerCase()) ||
        trait.toLowerCase().includes(agentTrait.toLowerCase())
      )
    );
  }

  getScenarioForAgent(
    agentPersonality: string,
    confidenceLevel: number,
    excludedIds: number[] = []
  ): Scenario | null {
    if (!this.initialized || this.scenarios.length === 0) {
      return null;
    }
    
    const relationLevel = this.getRelationLevelFromConfidence(confidenceLevel);
    const agentTraits = this.mapPersonalityToTraits(agentPersonality);
    
    // Filtrer les scénarios compatibles
    const compatibleScenarios = this.scenarios.filter(scenario => {
      // Vérifier le niveau de relation
      if (scenario.relationLevel > relationLevel) {
        return false;
      }
      
      // Vérifier les personnalités requises
      if (!this.personalityMatchesRequirements(agentTraits, scenario.personalityRequired)) {
        return false;
      }
      
      // Exclure les scénarios déjà utilisés
      if (excludedIds.includes(scenario.id)) {
        return false;
      }
      
      return true;
    });
    
    if (compatibleScenarios.length === 0) {
      return null;
    }
    
    // Choisir un scénario aléatoirement
    const randomIndex = Math.floor(Math.random() * compatibleScenarios.length);
    return compatibleScenarios[randomIndex];
  }

  getAllScenarios(): Scenario[] {
    return [...this.scenarios];
  }

  getScenarioById(id: number): Scenario | null {
    return this.scenarios.find(scenario => scenario.id === id) || null;
  }
}

// Singleton instance
export const topicReservoirService = new TopicReservoirService();