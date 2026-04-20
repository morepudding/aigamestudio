/**
 * Utilities for parsing and classifying [émotion: ...] tags in agent messages.
 * The AI emits at most one [émotion: description] tag per message.
 */

export type EmotionType = "intense" | "joyeuse" | "subtile" | null;

export interface ParsedMessage {
  text: string;
  emotion: string | null;
  emotionType: EmotionType;
}

// Keywords that indicate an intense / dramatic emotion
const INTENSE_KW = [
  "carnassier", "perçant", "intense", "sombre", "glacial", "acéré",
  "froid", "déterminé", "méfiant", "menaçant", "dur", "tranchant",
  "fixe", "accroch", "acéré", "tendu", "défiant",
];

// Keywords that indicate joy / positive energy
const JOYEUSE_KW = [
  "sourire", "rit", "rires", "éclat", "enthousiaste", "joyeux",
  "joyeuse", "content", "amusé", "malicieux", "espiègle", "pétillant",
  "euphorie", "excité", "excitée", "ravi", "ravie", "satisfait",
];

// Keywords that indicate subtle / shy emotion
const SUBTILE_KW = [
  "rougit", "rougeur", "baisse les yeux", "regard fuyant", "gêne",
  "embarras", "timide", "en coin", "hésit", "pudique", "retenu",
  "discret", "discrète", "baisser", "détourne",
];

function classifyEmotion(emotion: string): EmotionType {
  const lower = emotion.toLowerCase();
  if (INTENSE_KW.some((k) => lower.includes(k))) return "intense";
  if (SUBTILE_KW.some((k) => lower.includes(k))) return "subtile";
  if (JOYEUSE_KW.some((k) => lower.includes(k))) return "joyeuse";
  return null; // unknown → suppress
}

const EMOTION_REGEX = /\[émotion\s*:\s*([^\]]+)\]/i;

/**
 * Preserve emphasized markdown content while removing the marker characters.
 * This avoids truncating messages that use *italics* or **bold** for style.
 */
const BOLD_MARKDOWN_REGEX = /\*\*([^*]+)\*\*/g;
const ITALIC_MARKDOWN_REGEX = /\*([^*]+)\*/g;

export function parseEmotion(content: string): ParsedMessage {
  const match = content.match(EMOTION_REGEX);

  // Strip [émotion: ...] tag
  let text = content.replace(EMOTION_REGEX, "").trim();
  // Remove markdown markers but keep the wrapped content.
  text = text
    .replace(BOLD_MARKDOWN_REGEX, "$1")
    .replace(ITALIC_MARKDOWN_REGEX, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!match) return { text, emotion: null, emotionType: null };

  const emotion = match[1].trim();
  const emotionType = classifyEmotion(emotion);

  return { text, emotion, emotionType };
}

/** Pick a fitting emoji for a joyeuse emotion */
export function joyeuseEmoji(emotion: string): string {
  const lower = emotion.toLowerCase();
  if (lower.includes("éclat") || lower.includes("rit")) return "😄";
  if (lower.includes("malicieux") || lower.includes("espiègle")) return "😏";
  if (lower.includes("satisf")) return "😌";
  if (lower.includes("excit")) return "✨";
  if (lower.includes("entousiasm") || lower.includes("enthousiast")) return "🤩";
  return "😊";
}
