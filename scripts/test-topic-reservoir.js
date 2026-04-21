// Script de test pour le Topic Reservoir
const { TopicReservoirService } = require('../lib/services/topicReservoirService');

async function testTopicReservoir() {
  console.log('=== Test du Topic Reservoir Service ===\n');
  
  try {
    const service = new TopicReservoirService();
    
    // Attendre que le service soit initialisé
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Récupérer tous les scénarios
    const allScenarios = service.getAllScenarios();
    console.log(`✅ Scénarios chargés: ${allScenarios.length}`);
    
    if (allScenarios.length === 0) {
      console.log('❌ Aucun scénario chargé. Vérifiez le fichier docs/topic-reservoir.md');
      return;
    }
    
    // Afficher quelques scénarios
    console.log('\n=== Exemples de scénarios ===');
    for (let i = 0; i < Math.min(3, allScenarios.length); i++) {
      const scenario = allScenarios[i];
      console.log(`\nScénario #${scenario.id}: ${scenario.title}`);
      console.log(`Niveau relation: ${scenario.relationLevel}`);
      console.log(`Thèmes: ${scenario.themes.join(', ')}`);
      console.log(`Exemples: ${scenario.examples.slice(0, 2).join(' | ')}`);
    }
    
    // Tester la sélection par agent
    console.log('\n=== Test de sélection par agent ===');
    
    const testCases = [
      { personality: 'dragueuse', confidence: 10, expectedLevel: 1 },
      { personality: 'expressive', confidence: 50, expectedLevel: 2 },
      { personality: 'impulsive', confidence: 150, expectedLevel: 3 },
      { personality: 'timide', confidence: 200, expectedLevel: 3 },
    ];
    
    for (const testCase of testCases) {
      console.log(`\nTest: ${testCase.personality} (confiance: ${testCase.confidence})`);
      const scenario = service.getScenarioForAgent(testCase.personality, testCase.confidence);
      
      if (scenario) {
        console.log(`✅ Scénario trouvé: "${scenario.title}" (niveau ${scenario.relationLevel})`);
        console.log(`   Compatibilité: ${scenario.relationLevel <= testCase.expectedLevel ? '✅' : '❌'}`);
      } else {
        console.log(`❌ Aucun scénario trouvé pour cette combinaison`);
      }
    }
    
    // Tester avec exclusion d'IDs
    console.log('\n=== Test avec exclusion d\'IDs ===');
    const excludedIds = [1, 2, 3];
    const scenarioWithExclusion = service.getScenarioForAgent('dragueuse', 50, excludedIds);
    
    if (scenarioWithExclusion) {
      console.log(`✅ Scénario trouvé avec exclusion: "${scenarioWithExclusion.title}"`);
      console.log(`   ID: ${scenarioWithExclusion.id}, Exclu: ${excludedIds.includes(scenarioWithExclusion.id) ? '❌' : '✅'}`);
    }
    
    console.log('\n=== Test terminé avec succès ===');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  }
}

// Exécuter le test
testTopicReservoir();