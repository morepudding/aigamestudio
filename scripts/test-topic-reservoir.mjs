import { topicReservoirService } from '../lib/services/topicReservoirService.js';

async function testTopicReservoir() {
  console.log('=== Test du Topic Reservoir Service ===\n');
  
  // Attendre que le service soit initialisé
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Récupérer tous les scénarios
  const allScenarios = topicReservoirService.getAllScenarios();
  console.log(`Nombre total de scénarios chargés: ${allScenarios.length}`);
  
  if (allScenarios.length > 0) {
    console.log('\nPremier scénario:');
    const firstScenario = allScenarios[0];
    console.log(`- Titre: ${firstScenario.title}`);
    console.log(`- Niveau relation: ${firstScenario.relationLevel}`);
    console.log(`- Thèmes: ${firstScenario.themes.join(', ')}`);
    console.log(`- Exemples: ${firstScenario.examples.length}`);
    
    // Tester la sélection pour différentes personnalités et niveaux de confiance
    console.log('\n=== Tests de sélection ===');
    
    const testCases = [
      { personality: 'dragueuse', confidence: 10, description: 'Inconnu, dragueuse' },
      { personality: 'dragueuse', confidence: 50, description: 'Collègue, dragueuse' },
      { personality: 'dragueuse', confidence: 150, description: 'Ami, dragueuse' },
      { personality: 'timide', confidence: 50, description: 'Collègue, timide' },
      { personality: 'expressive', confidence: 50, description: 'Collègue, expressive' },
      { personality: 'impulsive', confidence: 50, description: 'Collègue, impulsive' },
    ];
    
    for (const testCase of testCases) {
      const scenario = topicReservoirService.getScenarioForAgent(
        testCase.personality,
        testCase.confidence,
        []
      );
      
      console.log(`\n${testCase.description}:`);
      if (scenario) {
        console.log(`  ✓ Scénario trouvé: "${scenario.title}" (niveau ${scenario.relationLevel})`);
        console.log(`    Personnalité requise: ${scenario.personalityRequired?.join(', ') || 'aucune'}`);
      } else {
        console.log(`  ✗ Aucun scénario trouvé`);
      }
    }
    
    // Tester la rotation (exclusion d'IDs)
    console.log('\n=== Test de rotation ===');
    const excludedIds = [1, 2, 3];
    const scenarioWithExclusion = topicReservoirService.getScenarioForAgent(
      'dragueuse',
      50,
      excludedIds
    );
    
    if (scenarioWithExclusion) {
      console.log(`Scénario trouvé avec exclusion [${excludedIds.join(', ')}]:`);
      console.log(`- ID: ${scenarioWithExclusion.id}`);
      console.log(`- Titre: ${scenarioWithExclusion.title}`);
    }
  } else {
    console.log('Aucun scénario chargé. Vérifiez le fichier topic-reservoir.md');
  }
  
  console.log('\n=== Test terminé ===');
}

testTopicReservoir().catch(console.error);