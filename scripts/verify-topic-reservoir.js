// Script de vérification du Topic Reservoir
console.log('=== Vérification du système Topic Reservoir ===\n');

// Vérifier que les fichiers existent
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'lib/services/topicReservoirService.ts',
  'lib/services/scenarioHistoryService.ts',
  'app/api/ai/nudge/route.ts',
  'supabase/migrations/042_2025040821000000_add_conversations_metadata.sql',
  'docs/topic-reservoir.md'
];

console.log('1. Vérification des fichiers :');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Vérifier le contenu du fichier topic-reservoir.md
console.log('\n2. Vérification du fichier topic-reservoir.md :');
try {
  const content = fs.readFileSync(path.join(process.cwd(), 'docs/topic-reservoir.md'), 'utf-8');
  const scenarioCount = (content.match(/### \d+\./g) || []).length;
  console.log(`  ✅ ${scenarioCount} scénarios détectés`);
  
  // Vérifier la structure
  const hasSituation = content.includes('**Situation**');
  const hasAction = content.includes('**Action**');
  const hasExamples = content.includes('**Exemples**');
  
  console.log(`  ${hasSituation ? '✅' : '❌'} Structure: Situation`);
  console.log(`  ${hasAction ? '✅' : '❌'} Structure: Action`);
  console.log(`  ${hasExamples ? '✅' : '❌'} Structure: Exemples`);
} catch (error) {
  console.log(`  ❌ Erreur de lecture: ${error.message}`);
}

// Vérifier la migration
console.log('\n3. Vérification de la migration :');
try {
  const migrationContent = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/042_2025040821000000_add_conversations_metadata.sql'),
    'utf-8'
  );
  const hasMetadataColumn = migrationContent.includes('ADD COLUMN IF NOT EXISTS metadata JSONB');
  const hasIndex = migrationContent.includes('CREATE INDEX IF NOT EXISTS conversations_metadata_idx');
  
  console.log(`  ${hasMetadataColumn ? '✅' : '❌'} Colonne metadata`);
  console.log(`  ${hasIndex ? '✅' : '❌'} Index GIN`);
} catch (error) {
  console.log(`  ❌ Erreur de lecture: ${error.message}`);
}

// Vérifier l'endpoint nudge
console.log('\n4. Vérification de l\'endpoint nudge :');
try {
  const nudgeContent = fs.readFileSync(
    path.join(process.cwd(), 'app/api/ai/nudge/route.ts'),
    'utf-8'
  );
  const hasTopicReservoirImport = nudgeContent.includes('topicReservoirService');
  const hasScenarioHistoryImport = nudgeContent.includes('scenarioHistoryService');
  const hasScenarioSelection = nudgeContent.includes('getScenarioForAgent');
  const hasScenarioRecording = nudgeContent.includes('addUsedScenario');
  
  console.log(`  ${hasTopicReservoirImport ? '✅' : '❌'} Import TopicReservoirService`);
  console.log(`  ${hasScenarioHistoryImport ? '✅' : '❌'} Import ScenarioHistoryService`);
  console.log(`  ${hasScenarioSelection ? '✅' : '❌'} Sélection de scénario`);
  console.log(`  ${hasScenarioRecording ? '✅' : '❌'} Enregistrement du scénario`);
} catch (error) {
  console.log(`  ❌ Erreur de lecture: ${error.message}`);
}

console.log('\n=== Vérification terminée ===');
console.log('\nProchaines étapes :');
console.log('1. Exécuter la migration Supabase :');
console.log('   - Appliquer le fichier 042_2025040821000000_add_conversations_metadata.sql');
console.log('\n2. Tester l\'endpoint nudge :');
console.log('   - Lancer le serveur de développement');
console.log('   - Vérifier que les nudge utilisent les scénarios');
console.log('\n3. Vérifier les logs :');
console.log('   - Chercher "[TopicReservoir] Loaded X scenarios" au démarrage');
console.log('   - Vérifier que les scénarios sont sélectionnés selon la confiance');