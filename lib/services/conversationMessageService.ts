type ConversationMode = "welcome" | "reply" | "discovery" | "nudge";
export type UserSignalLevel = "low" | "medium" | "open";

const TECHNICAL_TOPIC_PATTERN = /\b(dev|developp|code|react|framework|bug|pipeline|cloud|api|pull request|pr|commit|kafka|sidecar|cyber|securit|mini-jeu|game ?design|jump spy|academia vespana|vn|moteur)\b/i;
const STAGE_WORD_PATTERN = /\b(bruit|rire|sourire|regard|voix|tapote|frotte|soupir|clavier|tasse|stylo|baisse la voix|hausse les epaules)\b/i;
const PLACEHOLDER_PATTERN = /\[[^\]\n]{1,60}\]/g;
const NARRATIVE_FRAGMENT_PATTERN = /(^|\n)\s*(?:regarde|regardant|hausse les epaules|baisse la voix|sourit|soupire|rit|tapote|frotte|fixe|hausse un sourcil)\b[^\n.!?]*(?=\n|$)/gim;
const PSEUDO_NARRATIVE_OPENING_PATTERN = /^(?:dans mon bureau|dans ma chambre|sur mon canape|sur mon canapé|par la fenetre|par la fenêtre|devant la fenetre|devant la fenêtre|au fond de|dans un coin|dans ma tete|dans ma tête)\b.*\b(?:a |à |en train de |a regarder|à regarder|a me demander|à me demander|a fixer|à fixer)\b/i;
const THIN_REPLY_PATTERN = /^\s*(?:je vois|ah ouais|ouais|ok|d'accord|raconte un peu|raconte)\s*[.!?]*\s*$/i;
const WEAK_USER_SIGNAL_PATTERN = /^\s*(?:oui|ouais|non|ok|okay|d'accord|pas faux|j'avoue|grave|mdr|haha+|hahaha+|peut[- ]?etre|bof|mouais|pas terrible|exactement|clairement|pas mal|pas facile|je vois|c'est vrai|si tu veux|comme tu veux|vasy|vas-y|peu importe|toujours debout mais pas facile|c'est bien vrai ca|clairement pas|pas faux|excatement\s*;?\)?|exactement\s*;?\)?|seulement si tu en as envie|je bois un cafe et toi\s*:?[)\]]?)\s*$/i;
const OPEN_USER_SIGNAL_PATTERN = /\b(j'ose pas|je n'ose pas|je suis timide|ca me gene|ça me gene|ca me gêne|ça me gêne|j'ose pas dire|je veux pas dire|je ne veux pas dire|c'est perso|c'est personnel|je me sens|je me suis senti|je suis mal|je suis pas bien|je suis bien|ca me touche|ça me touche|je prefere pas|je préfère pas|j'ai reve|j'ai rêvé|j'ai peur|j'ai honte|je suis gene|je suis gêné|je suis gênée|ca me fait quelque chose|ça me fait quelque chose|tu peux garder ca pour toi|garde ca pour toi)\b/i;

function stripFormatting(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[(?:e|é)motion:[^\]]+\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripPlaceholders(value: string): string {
  return value.replace(PLACEHOLDER_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

function stripStageDirections(value: string): string {
  let text = value.trim();
  const firstQuoteIndex = text.search(/["“]/);
  if (firstQuoteIndex > 12) {
    const prefix = text.slice(0, firstQuoteIndex);
    if (STAGE_WORD_PATTERN.test(prefix)) {
      text = text.slice(firstQuoteIndex + 1);
    }
  }

  const lastQuoteIndex = Math.max(text.lastIndexOf('"'), text.lastIndexOf('”'));
  if (lastQuoteIndex > 0 && lastQuoteIndex >= text.length - 140) {
    const suffix = text.slice(lastQuoteIndex + 1);
    if (STAGE_WORD_PATTERN.test(suffix)) {
      text = text.slice(0, lastQuoteIndex);
    }
  }

  return text
    .replace(NARRATIVE_FRAGMENT_PATTERN, "$1")
    .replace(/["“”]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function trimToSentenceCount(value: string, maxSentences: number): string {
  const sentences = value.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  if (sentences.length <= maxSentences) {
    return value.trim();
  }
  return sentences.slice(0, maxSentences).join(" ").trim();
}

function trimToCharCount(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  const trimmed = value.slice(0, maxChars);
  const lastBoundary = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf("?"), trimmed.lastIndexOf("!"), trimmed.lastIndexOf(","), trimmed.lastIndexOf(" "));
  return `${trimmed.slice(0, lastBoundary > 40 ? lastBoundary : maxChars).trim()}...`;
}

function getModeLimits(mode: ConversationMode): { maxBubbles: number; maxSentences: number; maxChars: number } {
  switch (mode) {
    case "nudge":
      return { maxBubbles: 1, maxSentences: 2, maxChars: 220 };
    case "discovery":
      return { maxBubbles: 1, maxSentences: 2, maxChars: 220 };
    case "welcome":
      return { maxBubbles: 2, maxSentences: 2, maxChars: 240 };
    case "reply":
    default:
      return { maxBubbles: 2, maxSentences: 3, maxChars: 360 };
  }
}

function buildFallback(mode: ConversationMode, userMessage?: string): string {
  if (mode === "nudge") {
    return "tu t'es pose un peu ou pas encore ?";
  }
  if (mode === "discovery") {
    return "je vois. c'est quoi ton mood là ?";
  }
  if (mode === "welcome") {
    return "salut, tu fais quoi là ?";
  }
  if (userMessage && userMessage.trim()) {
    return "je vois un peu. qu'est-ce qui te fait dire ca ?";
  }
  return "ouais, je vois.";
}

export function userTriggeredProfessionalTopic(value?: string): boolean {
  return Boolean(value && TECHNICAL_TOPIC_PATTERN.test(value));
}

export function getUserSignalLevel(value?: string): UserSignalLevel {
  if (!value || !value.trim()) {
    return "low";
  }

  const normalized = value.trim();
  if (OPEN_USER_SIGNAL_PATTERN.test(normalized)) {
    return "open";
  }

  if (WEAK_USER_SIGNAL_PATTERN.test(normalized)) {
    return "low";
  }

  return "medium";
}

export function normalizeConversationMessage(
  content: string,
  options: { mode: ConversationMode; userMessage?: string }
): string {
  const { mode, userMessage } = options;
  const limits = getModeLimits(mode);

  const cleaned = stripStageDirections(stripPlaceholders(stripFormatting(content)));
  const bubbles = cleaned
    .split("|||")
    .map((bubble) => trimToCharCount(trimToSentenceCount(bubble.trim(), limits.maxSentences), limits.maxChars))
    .filter(Boolean)
    .slice(0, limits.maxBubbles);

  let normalized = bubbles.join(" ||| ").trim();
  if (!normalized) {
    return buildFallback(mode, userMessage);
  }

  if (!userTriggeredProfessionalTopic(userMessage) && mode === "nudge" && TECHNICAL_TOPIC_PATTERN.test(normalized)) {
    return buildFallback(mode, userMessage);
  }

  if (PLACEHOLDER_PATTERN.test(normalized)) {
    return buildFallback(mode, userMessage);
  }

  if ((mode === "nudge" || mode === "discovery") && PSEUDO_NARRATIVE_OPENING_PATTERN.test(normalized)) {
    return buildFallback(mode, userMessage);
  }

  if (mode === "reply" && THIN_REPLY_PATTERN.test(normalized)) {
    return buildFallback(mode, userMessage);
  }

  normalized = normalized.replace(/\s+\|\|\|\s+/g, " ||| ").trim();
  return normalized || buildFallback(mode, userMessage);
}