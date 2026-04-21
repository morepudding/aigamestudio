const fs = require('fs');
const path = require('path');

function parseMarkdown(content) {
  const scenarios = [];
  
  // Diviser par les scénarios (commençant par ### X. Titre)
  const scenarioRegex = /### (\d+)\. (.+?)(?=### \d+\. |\n## |$)/gs;
  let match;
  let scenarioId = 1;
  
  while ((match = scenarioRegex.exec(content)) !== null) {
    const [, number, title] = match;
    const scenarioContent = match[0];
    
    const scenario = {
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
    
    // Extraire les champs avec regex plus robuste
    const situationMatch = scenarioContent.match(/\*\*Situation\*\* : (.+?)(?=\n\*\*|\n\n|$)/s);
    if (situationMatch) scenario.situation = situationMatch[1].trim();
    
    const actionMatch = scenarioContent.match(/\*\*Action\*\* : (.+?)(?=\n\*\*|\n\n|$)/s);
    if (actionMatch) scenario.action = actionMatch[1].trim();
    
    const subtextMatch = scenarioContent.match(/\*\*Sous-texte\*\* : (.+?)(?=\n\*\*|\n\n|$)/s);
    if (subtextMatch) scenario.subtext = subtextMatch[1].trim();
    
    const moodMatch = scenarioContent.match(/\*\*Mood\*\* : (.+?)(?=\n\*\*|\n\n|$)/s);
    if (moodMatch) scenario.mood = moodMatch[1].trim();
    
    const themesMatch = scenarioContent.match(/\*\*Thèmes\*\* : (.+?)(?=\n\*\*|\n\n|$)/s);
    if (themesMatch) {
      const themesText = themesMatch[1].trim();
      scenario.themes = themesText.split(',').map(t => t.trim().replace(/`/g, ''));
    }
    
    const relationMatch = scenarioContent.match(/\*\*Niveau relation\*\* : `(\d)`/);
    if (relationMatch) {
      scenario.relationLevel = parseInt(relationMatch[1]);
    }
    
    const personalityMatch = scenarioContent.match(/\*\*Personnalité requis\*\* : (.+?)(?=\n\*\*|\n\n|$)/s);
    if (personalityMatch) {
      const personalityText = personalityMatch[1].trim();
      scenario.personalityRequired = personalityText.split(',').map(p => p.trim().replace(/`/g, ''));
    }
    
    // Extraire les exemples
    const examplesMatch = scenarioContent.match(/\*\*Exemples\*\* :\n((?:- .+\n?)+)/);
    if (examplesMatch) {
      const examplesText = examplesMatch[1];
      scenario.examples = examplesText
        .split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.replace('- ', '').trim());
    }
    
    scenarios.push(scenario);
  }
  
  return scenarios;
}

// Test du parser
const filePath = path.join(__dirname, '..', 'docs', 'topic-reservoir.md');
const content = fs.readFileSync(filePath, 'utf-8');
const scenarios = parseMarkdown(content);

console.log(`Nombre de scénarios parsés: ${scenarios.length}\n`);

if (scenarios.length > 0) {
  console.log('Premier scénario:');
  const first = scenarios[0];
  console.log(`- Titre: ${first.title}`);
  console.log(`- Situation: ${first.situation.substring(0, 50)}...`);
  console.log(`- Action: ${first.action.substring(0, 50)}...`);
  console.log(`- Niveau: ${first.relationLevel}`);
  console.log(`- Thèmes: ${first.themes.join(', ')}`);
  console.log(`- Exemples: ${first.examples.length}`);
  
  console.log('\nTous les scénarios:');
  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.title} (niveau ${scenario.relationLevel})`);
  });
}