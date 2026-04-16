import type { Department, Gender, PersonalityTrait } from "@/lib/types/agent";

export const departments: { id: Department; label: string; emoji: string; description: string }[] = [
  { id: "art", label: "Art & Direction Artistique", emoji: "🎨", description: "Concept art, UI, 3D, animations" },
  { id: "programming", label: "Programmation", emoji: "💻", description: "Gameplay, engine, outils, réseau" },
  { id: "game-design", label: "Game Design", emoji: "🎮", description: "Mécaniques, levels, balancing" },
  { id: "audio", label: "Audio & Musique", emoji: "🎵", description: "SFX, musique, sound design" },
  { id: "narrative", label: "Narration & Scénario", emoji: "📝", description: "Story, dialogues, worldbuilding" },
  { id: "qa", label: "QA & Testing", emoji: "🧪", description: "Tests, bugs, qualité, automation" },
  { id: "marketing", label: "Marketing & Community", emoji: "📢", description: "Réseaux sociaux, trailers, events" },
  { id: "production", label: "Production & Management", emoji: "📋", description: "Planning, sprints, coordination" },
];

export const genders: { id: Gender; label: string; emoji: string }[] = [
  { id: "homme", label: "Homme", emoji: "♂️" },
  { id: "femme", label: "Femme", emoji: "♀️" },
];

export const personalities: { id: PersonalityTrait; label: string; emoji: string; description: string; famille: string }[] = [
  // Sociale
  { id: "empathique",     label: "Empathique",     emoji: "💙", description: "Attentionnée, à l'écoute, ressent les émotions des autres",  famille: "Sociale" },
  { id: "maternelle",     label: "Maternelle",     emoji: "🤍", description: "Protectrice, rassurante, prend soin de tout le monde",        famille: "Sociale" },
  { id: "distante",       label: "Distante",       emoji: "🧊", description: "Froide, factuelle, garde ses distances",                      famille: "Sociale" },
  { id: "manipulatrice",  label: "Manipulatrice",  emoji: "🕸️", description: "Calculatrice, stratège, toujours deux longueurs d'avance",    famille: "Sociale" },
  { id: "possessive",     label: "Possessive",     emoji: "🔒", description: "Jalouse de son territoire, surveille, retient",               famille: "Sociale" },
  // Émotionnelle
  { id: "melancolique",   label: "Mélancolique",   emoji: "🌧️", description: "Nostalgique, profonde, porte un poids invisible",             famille: "Émotionnelle" },
  { id: "optimiste",      label: "Optimiste",      emoji: "🌟", description: "Lumineuse, voit toujours le bon côté, entraînante",           famille: "Émotionnelle" },
  { id: "impulsive",      label: "Impulsive",      emoji: "⚡", description: "Réagit vite, sans filtre, intense et spontanée",              famille: "Émotionnelle" },
  { id: "stoique",        label: "Stoïque",        emoji: "🗿", description: "Impassible, contrôlée, ne montre rien",                       famille: "Émotionnelle" },
  { id: "vulnerable",     label: "Vulnérable",     emoji: "🥺", description: "Sensible, hésitante, s'ouvre rarement mais profondément",     famille: "Émotionnelle" },
  // Intellectuelle
  { id: "perfectionniste",label: "Perfectionniste",emoji: "🎯", description: "Exigeante, rigoureuse, l'à-peu-près l'énerve",               famille: "Intellectuelle" },
  { id: "curieuse",       label: "Curieuse",       emoji: "🔍", description: "Pose des questions, explore, s'intéresse à tout",             famille: "Intellectuelle" },
  { id: "analytique",     label: "Analytique",     emoji: "📊", description: "Rationnelle, structurée, pense en données et schémas",        famille: "Intellectuelle" },
  { id: "creative",       label: "Créative",       emoji: "🎨", description: "Déborde d'idées, pense hors cadre, fait des connexions folles",famille: "Intellectuelle" },
  { id: "dispersee",      label: "Dispersée",      emoji: "💨", description: "Part dans tous les sens, oublie, rebondit sans prévenir",     famille: "Intellectuelle" },
  // Relationnelle
  { id: "loyale",         label: "Loyale",         emoji: "🛡️", description: "Fiable, indéfectible, ne lâche jamais ceux qu'elle aime",    famille: "Relationnelle" },
  { id: "jalouse",        label: "Jalouse",        emoji: "💚", description: "Possessive, susceptible, compare en permanence",              famille: "Relationnelle" },
  { id: "rivale",         label: "Rivale",         emoji: "🏆", description: "Compétitive, veut toujours être la meilleure",               famille: "Relationnelle" },
  { id: "admirative",     label: "Admirative",     emoji: "🤩", description: "S'enthousiasme facilement, met sur un piédestal",            famille: "Relationnelle" },
  { id: "rebelle",        label: "Rebelle",        emoji: "🔥", description: "Conteste, refuse l'autorité, fait à sa façon",               famille: "Relationnelle" },
  // Caractère
  { id: "dominante",      label: "Dominante",      emoji: "👑", description: "Sûre d'elle, prend le contrôle, légèrement condescendante",  famille: "Caractère" },
  { id: "soumise",        label: "Soumise",        emoji: "🌿", description: "Efface ses besoins, cherche l'approbation, difficile à lire", famille: "Caractère" },
  { id: "franche",        label: "Franche",        emoji: "🗣️", description: "Dit ce qu'elle pense, sans détour, parfois trop directe",    famille: "Caractère" },
  { id: "mysterieuse",    label: "Mystérieuse",    emoji: "🔮", description: "Énigmatique, cryptique, révèle peu d'elle-même",             famille: "Caractère" },
  { id: "provocatrice",   label: "Provocatrice",   emoji: "😏", description: "Aime titiller, tester les limites, créer des étincelles",    famille: "Caractère" },
];

export const appearanceOptions = {
  femme: {
    cheveux: [
      { value: "blonde", label: "Blonde" },
      { value: "brune", label: "Brune" },
      { value: "rousse", label: "Rousse" },
      { value: "noire", label: "Noire" },
      { value: "blanche", label: "Blanche / Argentée" },
      { value: "rose", label: "Rose" },
      { value: "bleue", label: "Bleue" },
      { value: "verte", label: "Verte" },
      { value: "violette", label: "Violette" },
    ],
    yeux: [
      { value: "bleus", label: "Bleus" },
      { value: "verts", label: "Verts" },
      { value: "marrons", label: "Marrons" },
      { value: "noirs", label: "Noirs" },
      { value: "gris", label: "Gris" },
      { value: "violets", label: "Violets" },
      { value: "ambre", label: "Ambre" },
    ],
    morphologie: [
      { value: "mince", label: "Mince" },
      { value: "athletique", label: "Athlétique" },
      { value: "pulpeuse", label: "Pulpeuse" },
      { value: "petite-fine", label: "Petite & Fine" },
      { value: "grande-elancee", label: "Grande & Élancée" },
    ],
    taille: [
      { value: "petite", label: "Petite (< 1m60)" },
      { value: "moyenne", label: "Moyenne (1m60-1m70)" },
      { value: "grande", label: "Grande (> 1m70)" },
    ],
    style: [
      { value: "casual", label: "Casual / Décontracté" },
      { value: "corporate", label: "Corporate / Pro" },
      { value: "punk", label: "Punk / Rock" },
      { value: "kawaii", label: "Kawaii / Cute" },
      { value: "gothic", label: "Gothic / Dark" },
      { value: "streetwear", label: "Streetwear / Urban" },
      { value: "militaire", label: "Militaire / Tactical" },
      { value: "boheme", label: "Bohème / Artiste" },
    ],
    traitDistinctif: [
      { value: "piercings", label: "Piercings" },
      { value: "tatouages", label: "Tatouages" },
      { value: "lunettes", label: "Lunettes" },
      { value: "cicatrice", label: "Cicatrice" },
      { value: "taches-de-rousseur", label: "Taches de rousseur" },
      { value: "heterochromie", label: "Hétérochromie (yeux différents)" },
      { value: "aucun", label: "Aucun" },
    ],
  },
  homme: {
    cheveux: [
      { value: "blond", label: "Blond" },
      { value: "brun", label: "Brun" },
      { value: "roux", label: "Roux" },
      { value: "noir", label: "Noir" },
      { value: "gris", label: "Gris / Argenté" },
      { value: "chauve", label: "Chauve" },
      { value: "blanc", label: "Blanc" },
      { value: "bleu", label: "Bleu" },
    ],
    morphologie: [
      { value: "mince", label: "Mince" },
      { value: "muscle", label: "Musclé" },
      { value: "costaud", label: "Costaud" },
      { value: "elance", label: "Élancé" },
      { value: "trapu", label: "Trapu" },
    ],
    style: [
      { value: "casual", label: "Casual / Décontracté" },
      { value: "corporate", label: "Corporate / Pro" },
      { value: "streetwear", label: "Streetwear / Urban" },
      { value: "militaire", label: "Militaire / Tactical" },
      { value: "vintage", label: "Vintage / Rétro" },
      { value: "punk", label: "Punk / Rock" },
      { value: "techwear", label: "Techwear / Futuriste" },
    ],
    barbe: [
      { value: "rase", label: "Rasé" },
      { value: "barbe-courte", label: "Barbe courte / 3 jours" },
      { value: "barbe-longue", label: "Barbe longue" },
      { value: "bouc", label: "Bouc" },
      { value: "moustache", label: "Moustache" },
    ],
  },
} as const;

// ─── Color Maps for Visual Swatches ─────────────────────────
export const hairColors: Record<string, string> = {
  blonde: "#F0D060", blond: "#F0D060",
  brune: "#5C3317", brun: "#5C3317",
  rousse: "#B44830", roux: "#B44830",
  noire: "#1a1a1a", noir: "#1a1a1a",
  blanche: "#E8E8E8", blanc: "#E8E8E8",
  rose: "#FF69B4",
  bleue: "#4169E1", bleu: "#4169E1",
  verte: "#2ECC71",
  violette: "#8B5CF6",
  gris: "#A0A0A0",
  chauve: "#D2B48C",
};

export const eyeColors: Record<string, string> = {
  bleus: "#4A90D9",
  verts: "#2ECC71",
  marrons: "#8B4513",
  noirs: "#1a1a1a",
  gris: "#A0A0A0",
  violets: "#8B5CF6",
  ambre: "#FFBF00",
};

export const morphologyEmojis: Record<string, string> = {
  mince: "🩸", athletique: "🏃", pulpeuse: "🍑", "petite-fine": "🐿️",
  "grande-elancee": "🦒", muscle: "💪", costaud: "🐻", elance: "🦩", trapu: "🧱",
};

export const styleEmojis: Record<string, string> = {
  casual: "👕", corporate: "👔", punk: "🎸", kawaii: "🌸",
  gothic: "🖤", streetwear: "🧢", militaire: "🪖", boheme: "🎨",
  vintage: "📻", techwear: "⚡",
};

export const barbeEmojis: Record<string, string> = {
  rase: "✨", "barbe-courte": "🌱", "barbe-longue": "🧔", bouc: "🐐", moustache: "🥸",
};

export const traitEmojis: Record<string, string> = {
  piercings: "💎", tatouages: "🐉", lunettes: "🤓", cicatrice: "⚔️",
  "taches-de-rousseur": "🌞", heterochromie: "🔮", aucun: "—",
};

export const ethnies = [
  { value: "caucasienne", label: "Caucasienne", emoji: "🏻" },
  { value: "afro", label: "Afro / Noire", emoji: "🏿" },
  { value: "asiatique", label: "Asiatique", emoji: "🏻" },
  { value: "latino", label: "Latino / Hispanique", emoji: "🏽" },
  { value: "moyen-orientale", label: "Moyen-Orientale", emoji: "🏽" },
  { value: "sud-asiatique", label: "Sud-Asiatique", emoji: "🏽" },
  { value: "metisse", label: "Métissée / Mixed", emoji: "🏼" },
] as const;

export const ethnicColors: Record<string, string> = {
  caucasienne: "#F5D5B8",
  afro: "#4A2C17",
  asiatique: "#E8C99A",
  latino: "#C68642",
  "moyen-orientale": "#D4A574",
  "sud-asiatique": "#8B5E3C",
  metisse: "#B8855A",
};

export const ageRanges = [
  { value: "18-25", label: "18–25 ans" },
  { value: "26-35", label: "26–35 ans" },
  { value: "36-45", label: "36–45 ans" },
  { value: "46+", label: "46+ ans" },
] as const;
