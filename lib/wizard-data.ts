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

export const personalities: { id: PersonalityTrait; label: string; emoji: string; description: string }[] = [
  { id: "chaleureuse", label: "Chaleureuse", emoji: "🌸", description: "Douce, encourageante, bienveillante" },
  { id: "froide", label: "Froide", emoji: "🧊", description: "Distante, factuelle, efficace" },
  { id: "dragueuse", label: "Dragueuse", emoji: "💋", description: "Charmeuse, flirty, séductrice" },
  { id: "jalouse", label: "Jalouse", emoji: "💚", description: "Possessive, compétitive, susceptible" },
  { id: "sarcastique", label: "Sarcastique", emoji: "😏", description: "Pince-sans-rire, ironique, mordante" },
  { id: "timide", label: "Timide", emoji: "👉👈", description: "Réservée, hésitante, adorable" },
  { id: "arrogante", label: "Arrogante", emoji: "👑", description: "Sûre d'elle, condescendante, brillante" },
  { id: "geek-obsessionnelle", label: "Geek Obsessionnelle", emoji: "🤓", description: "Passionnée, références pop culture, intense" },
  { id: "mysterieuse", label: "Mystérieuse", emoji: "🔮", description: "Énigmatique, cryptique, fascinante" },
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
