/**
 * LPC (Liberated Pixel Cup) spritesheet layer mapping.
 *
 * Each layer is a URL to a raw PNG from the LPC generator's GitHub repo.
 * Layers are composited in order (bottom to top) by the generate-sprite API.
 *
 * Spritesheet format: 576×256 px (9 frames × 4 directions × 64 px)
 *   Row 0 = N (up), Row 1 = W (left), Row 2 = S (down ← default), Row 3 = E (right)
 */

const RAW =
  "https://raw.githubusercontent.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets";

// ── Skin tone from appearance_prompt ──────────────────────────────────────
// Parses free-text appearance description and maps to LPC skin tone.
// Fallback: "light" (caucasian default).
const SKIN_KEYWORDS: { keywords: string[]; tone: string }[] = [
  // Dark / sub-Saharan African
  {
    keywords: ["africain", "subsaharien", "noir", "dark skin", "peau noire", "peau sombre", "nigerian", "ghanaian", "sénégalais", "congolais", "kenyan", "ethiopien"],
    tone: "dark",
  },
  // South Asian / Indian
  {
    keywords: ["indien", "bangladeshais", "pakistanais", "sri lankais", "south asian", "dravidien"],
    tone: "darkbrown",
  },
  // Middle Eastern / North African / Arab
  {
    keywords: ["maghrébin", "arabe", "moyen-orient", "libanais", "syrien", "égyptien", "marocain", "algérien", "tunisien", "iranien", "turc", "middle eastern"],
    tone: "tanned",
  },
  // Latino / Hispanic / Mediterranean
  {
    keywords: ["latino", "hispanique", "brésilien", "mexicain", "colombien", "méditerranéen", "grec", "italien", "espagnol", "métis", "mixed"],
    tone: "tanned",
  },
  // East Asian / South-East Asian
  {
    keywords: ["asiatique", "japonais", "coréen", "chinois", "vietnamien", "thaïlandais", "philippin", "east asian", "southeast asian"],
    tone: "light",
  },
  // Caucasian / European (explicit)
  {
    keywords: ["caucasien", "européen", "français", "anglais", "allemand", "polonais", "russe", "scandinave", "nordique", "blanc", "white", "light skin"],
    tone: "light",
  },
];

export function skinToneFromAppearance(appearancePrompt: string): string {
  const lower = (appearancePrompt ?? "").toLowerCase();
  for (const entry of SKIN_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.tone;
    }
  }
  return "light"; // caucasian default
}

// ── Hair styles per department ─────────────────────────────────────────────
// Only styles confirmed present in hair/{style}/adult/walk.png
const HAIR_MALE_BY_DEPT: Record<string, string[]> = {
  art: ["messy1", "unkempt", "shorthawk"],
  programming: ["plain", "buzzcut", "ponytail"],
  "game-design": ["curtains", "bangs", "unkempt"],
  audio: ["dreadlocks_long", "afro", "long"],
  narrative: ["long", "ponytail", "parted"],
  qa: ["plain", "curtains", "bangs"],
  marketing: ["plain", "parted", "swoop"],
  production: ["plain", "buzzcut", "curtains"],
};

const HAIR_FEMALE_BY_DEPT: Record<string, string[]> = {
  art: ["messy1", "braid", "pigtails"],
  programming: ["ponytail", "bun", "pixie"],
  "game-design": ["pigtails", "wavy", "bunches"],
  audio: ["dreadlocks_long", "afro", "cornrows"],
  narrative: ["long", "wavy", "braid"],
  qa: ["ponytail", "pixie", "half_up"],
  marketing: ["wavy", "xlong_wavy", "bangs"],
  production: ["half_up", "pixie", "ponytail"],
};

// ── Pants colors per department ────────────────────────────────────────────
// Colors confirmed at legs/pants/{gender}/walk/{color}.png
const PANTS_BY_DEPT: Record<string, string[]> = {
  art: ["brown", "teal", "maroon"],
  programming: ["black", "navy", "charcoal"],
  "game-design": ["brown", "orange", "forest"],
  audio: ["black", "purple", "charcoal"],
  narrative: ["brown", "forest", "walnut"],
  qa: ["black", "green", "navy"],
  marketing: ["black", "red", "pink"],
  production: ["black", "navy", "blue"],
};

// ── Deterministic hash ─────────────────────────────────────────────────────
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface LpcLayerSpec {
  /** ordered list of full PNG URLs to composite (bottom → top) */
  layers: string[];
  /** Spritesheet dimensions: 576×256 (9 frames × 4 rows × 64px) */
  width: number;
  height: number;
}

export function getLpcLayersForAgent(
  slug: string,
  gender: string,
  department: string,
  appearancePrompt: string = ""
): LpcLayerSpec {
  const seed = djb2(slug);
  const dept = department in PANTS_BY_DEPT ? department : "production";
  const isFemale = gender === "femme";
  const genderKey = isFemale ? "female" : "male";

  // Hair: confirmed path = hair/{style}/adult/walk.png
  const hairStyles = isFemale
    ? (HAIR_FEMALE_BY_DEPT[dept] ?? ["long"])
    : (HAIR_MALE_BY_DEPT[dept] ?? ["plain"]);
  const hairStyle = pick(hairStyles, seed);

  // Pants color: confirmed path = legs/pants/{gender}/walk/{color}.png
  const pantsColors = PANTS_BY_DEPT[dept] ?? PANTS_BY_DEPT.production;
  const pantsColor = pick(pantsColors, seed + 2);

  const layers: string[] = [
    // Body — confirmed: body/bodies/{gender}/walk.png
    `${RAW}/body/bodies/${genderKey}/walk.png`,
    // Head — confirmed: head/heads/human/{gender}/walk.png
    `${RAW}/head/heads/human/${genderKey}/walk.png`,
    // Hair — confirmed: hair/{style}/adult/walk.png
    `${RAW}/hair/${hairStyle}/adult/walk.png`,
    // Torso — confirmed: torso/clothes/longsleeve/longsleeve/{gender}/walk.png
    `${RAW}/torso/clothes/longsleeve/longsleeve/${genderKey}/walk.png`,
    // Legs — confirmed: legs/pants/{gender}/walk/{color}.png
    `${RAW}/legs/pants/${genderKey}/walk/${pantsColor}.png`,
  ];

  return { layers, width: 576, height: 256 };
}
