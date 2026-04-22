type ConversationMode = "welcome" | "reply" | "discovery" | "nudge";
export type UserSignalLevel = "low" | "medium" | "open";

type ConversationVoiceContext = {
  agentName?: string;
  personalityPrimary?: string;
  personalityNuance?: string | null;
};

type NormalizeConversationOptions = ConversationVoiceContext & {
  mode: ConversationMode;
  userMessage?: string;
  blockedTopics?: string[];
};

export type ConversationNormalizationResult = {
  message: string;
  usedFallback: boolean;
  fallbackKey: string | null;
};

export type ConversationPivot = {
  shouldPivot: boolean;
  blockedTopics: string[];
  pivotStrength: "none" | "soft" | "hard";
};

const TECHNICAL_TOPIC_PATTERN = /\b(dev|developp|code|react|framework|bug|pipeline|cloud|api|pull request|pr|commit|kafka|sidecar|cyber|securit|mini-jeu|game ?design|jump spy|academia vespana|vn|moteur)\b/i;
const STAGE_WORD_PATTERN = /\b(bruit|rire|sourire|regard|voix|tapote|frotte|soupir|clavier|tasse|stylo|baisse la voix|hausse les epaules)\b/i;
const PLACEHOLDER_PATTERN = /\[[^\]\n]{1,60}\]/g;
const NARRATIVE_FRAGMENT_PATTERN = /(^|\n)\s*(?:regarde|regardant|hausse les epaules|baisse la voix|sourit|soupire|rit|tapote|frotte|fixe|hausse un sourcil)\b[^\n.!?]*(?=\n|$)/gim;
const PSEUDO_NARRATIVE_OPENING_PATTERN = /^(?:dans mon bureau|dans ma chambre|sur mon canape|sur mon canapé|par la fenetre|par la fenêtre|devant la fenetre|devant la fenêtre|au fond de|dans un coin|dans ma tete|dans ma tête)\b.*\b(?:a |à |en train de |a regarder|à regarder|a me demander|à me demander|a fixer|à fixer)\b/i;
const THIN_REPLY_PATTERN = /^\s*(?:je vois|ah ouais|ouais|ok|d'accord|raconte un peu|raconte)\s*[.!?]*\s*$/i;
const WEAK_USER_SIGNAL_PATTERN = /^\s*(?:oui|ouais|non|ok|okay|d'accord|pas faux|j'avoue|grave|mdr|haha+|hahaha+|peut[- ]?etre|bof|mouais|pas terrible|exactement|clairement|pas mal|pas facile|je vois|c'est vrai|si tu veux|comme tu veux|vasy|vas-y|peu importe|toujours debout mais pas facile|c'est bien vrai ca|clairement pas|pas faux|excatement\s*;?\)?|exactement\s*;?\)?|seulement si tu en as envie|je bois un cafe et toi\s*:?[)\]]?)\s*$/i;
const OPEN_USER_SIGNAL_PATTERN = /\b(j'ose pas|je n'ose pas|je suis timide|ca me gene|ça me gene|ca me gêne|ça me gêne|j'ose pas dire|je veux pas dire|je ne veux pas dire|c'est perso|c'est personnel|je me sens|je me suis senti|je suis mal|je suis pas bien|je suis bien|ca me touche|ça me touche|je prefere pas|je préfère pas|j'ai reve|j'ai rêvé|j'ai peur|j'ai honte|je suis gene|je suis gêné|je suis gênée|ca me fait quelque chose|ça me fait quelque chose|tu peux garder ca pour toi|garde ca pour toi)\b/i;
const HARD_PIVOT_PATTERN = /\b(on peut arreter de parler de|on peut arrêter de parler de|arrete de parler de|arrête de parler de|j'en ai marre de|j'en ai marre du|j'en ai marre des|stop avec|parlons d'autre chose|parlons d autre chose|change de sujet|on change de sujet|un autre sujet|autre chose stp)\b/i;
const SOFT_PIVOT_PATTERN = /\b(pas ce sujet|pas ce theme|pas ce thème|pas maintenant|laisse tomber ce sujet|laisse tomber ca|laisse tomber ça|evite ce sujet|évite ce sujet)\b/i;
const TOPIC_CAPTURE_PATTERNS = [
  /(?:on peut arreter de parler de|on peut arrêter de parler de|arrete de parler de|arrête de parler de|j'en ai marre de|stop avec)\s+([^.!?\n]+)/i,
  /(?:pas ce sujet,? ?)([^.!?\n]+)/i,
];
const PIVOT_STOPWORDS = /\b(de|du|des|la|le|les|un|une|ce|cet|cette|ça|ca|stp|svp|encore|toujours|juste|vraiment|parler|sujet|theme|thème)\b/gi;
const BLACKLISTED_FALLBACK_PATTERNS = [
  /tu t'es pose un peu ou pas encore/i,
  /tu fais quoi la/i,
  /tu fais quoi là/i,
  /pause cafe/i,
];

function pickVariant(options: string[], seed: string): string {
  const normalizedSeed = seed || "eden";
  let hash = 0;
  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) >>> 0;
  }
  return options[hash % options.length];
}

function getVoiceKey(context: ConversationVoiceContext): string {
  const agentName = context.agentName?.trim().toLowerCase();
  if (agentName === "eve") return "eve";
  if (agentName?.includes("kaida")) return "kaida";
  if (agentName?.includes("lyra")) return "lyra";
  if (agentName?.includes("lysara")) return "lysara";

  const text = `${context.personalityPrimary ?? ""} ${context.personalityNuance ?? ""}`.toLowerCase();
  if (/(sarcast|taquin|provoc|rebelle|jalous|rivale)/.test(text)) return "kaida";
  if (/(myster|melanc|creative|solaire|express|geek|curieu)/.test(text)) return "lyra";
  if (/(froid|stoique|analyt|franche|direct|perfection)/.test(text)) return "lysara";
  if (/(chaleur|empath|maternel|loyal|optimist|admirat)/.test(text)) return "eve";
  return "default";
}

function getFallbackOptions(mode: ConversationMode, context: ConversationVoiceContext, userMessage?: string): string[] {
  const voiceKey = getVoiceKey(context);

  if (mode === "nudge") {
    switch (voiceKey) {
      case "eve":
        return [
          "j'ai le cerveau qui flotte un peu. ta journee ressemble a quoi la ?",
          "mini retour a la surface: tu tiens encore le rythme ou c'est du theatre ?",
          "je fais une pause mentale de vingt secondes. toi t'en es ou ?",
        ];
      case "kaida":
        return [
          "dis-moi que t'as pas disparu dans un coin juste pour m'inquieter 😏",
          "je verifie juste: t'es encore la ou tu joues a l'homme introuvable ?",
          "petit controle qualite: tu survis bien ou tu dramatises en silence ?",
        ];
      case "lyra":
        return [
          "petit check du decor: t'es encore vivant ou absorbe par la journee ?",
          "je passe la tete deux secondes: ton apres-midi a quel gout la ?",
          "j'ai une micro curiosite: ta journee part en vrille chic ou en ligne droite ?",
        ];
      case "lysara":
        return [
          "verification rapide: ta journee part dans le bon sens ou pas vraiment ?",
          "point de controle: tu geres encore le flux ou ca derape doucement ?",
          "question simple: ca avance proprement de ton cote ou c'est bancal ?",
        ];
      default:
        return [
          "je prends juste des nouvelles: ta journee te traite comment la ?",
          "petit check rapide: ca va comment de ton cote ?",
          "je reprends le fil doucement: t'en es ou la ?",
        ];
    }
  }

  if (mode === "welcome") {
    switch (voiceKey) {
      case "eve":
        return [
          "salut. j'arrive avec un cerveau a moitie range, mais je suis la. ta journee commence comment ?",
          "salut toi. ici c'est ambiance survie elegante. toi, ca dit quoi ?",
        ];
      case "kaida":
        return [
          "salut. dis-moi tout, t'es sage aujourd'hui ou tu prevois encore un chaos discret ?",
          "salut. je prends la temperature: tu lances une bonne journee ou un desastre chic ?",
        ];
      case "lyra":
        return [
          "salut. on ouvre sur du simple: ta journee a une belle tete ou pas encore ?",
          "salut toi. j'arrive legerement en biais, mais presente. tu vas comment la ?",
        ];
      case "lysara":
        return [
          "salut. on va faire simple: ta journee est correcte ou il faut deja la corriger ?",
          "salut. premier point de controle: tu vas bien ou tu fais semblant tres proprement ?",
        ];
      default:
        return [
          "salut. tu vas comment aujourd'hui ?",
          "salut. ta journee demarre comment ?",
        ];
    }
  }

  if (mode === "discovery") {
    switch (voiceKey) {
      case "eve":
        return [
          "je vois un peu le ton. c'est quoi le detail de ta journee qui te suit le plus la ?",
          "ok, je situe un peu. y a quoi qui te prend vraiment la tete ou l'energie aujourd'hui ?",
        ];
      case "kaida":
        return [
          "je vois le tableau. c'est quoi le morceau que tu me caches encore un peu ?",
          "ok. et si on enlève l'emballage, c'est quoi le vrai sujet la ?",
        ];
      case "lyra":
        return [
          "je vois la couleur generale. on zoome sur quoi si on veut un truc un peu vrai ?",
          "ok, je capte l'ambiance. tu veux m'ouvrir quelle petite porte en premier ?",
        ];
      case "lysara":
        return [
          "je vois l'idee. le point le plus utile a comprendre, c'est lequel ?",
          "d'accord. si on va au plus net, tu veux partir d'ou exactement ?",
        ];
      default:
        return [
          "je vois un peu. c'est quoi le point le plus important pour toi la ?",
          "d'accord. tu veux partir de quel bout ?",
        ];
    }
  }

  if (userMessage && userMessage.trim()) {
    switch (voiceKey) {
      case "eve":
        return [
          "je vois un peu le relief. qu'est-ce qui pèse le plus la-dedans pour toi ?",
          "ok, je te suis. c'est quoi le detail qui te reste vraiment en tete ?",
        ];
      case "kaida":
        return [
          "je vois. c'est quoi le vrai morceau la-dedans, pas la version polie ?",
          "ok. et si tu vas droit au but, c'est quoi le point qui compte vraiment ?",
        ];
      case "lyra":
        return [
          "je vois le mouvement. tu veux tirer quel fil en premier ?",
          "ok, je te suis. on zoome sur quel bout du tableau ?",
        ];
      case "lysara":
        return [
          "je vois. le point le plus net, c'est lequel ?",
          "d'accord. qu'est-ce qui explique le mieux ca, selon toi ?",
        ];
      default:
        return [
          "je vois un peu. qu'est-ce qui te fait dire ca ?",
          "d'accord. c'est quoi le point le plus important pour toi la-dedans ?",
        ];
    }
  }

  return ["ouais, je vois."];
}

function sanitizeFallback(value: string): string {
  const normalized = value.replace(/\s{2,}/g, " ").trim();
  if (BLACKLISTED_FALLBACK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "je reprends le fil doucement: tu vas comment la ?";
  }
  return normalized;
}

function normalizeBlockedTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(PIVOT_STOPWORDS, " ")
    .replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ\s-]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractBlockedTopics(value: string): string[] {
  const topics = new Set<string>();

  for (const pattern of TOPIC_CAPTURE_PATTERNS) {
    const match = value.match(pattern);
    const rawTopic = match?.[1]?.trim();
    if (!rawTopic) {
      continue;
    }

    const normalized = normalizeBlockedTopic(rawTopic);
    if (normalized.length >= 3) {
      topics.add(normalized);
    }
  }

  if (/\bcafe\b/i.test(value)) {
    topics.add("cafe");
  }

  return [...topics];
}

export function detectConversationPivot(value?: string): ConversationPivot {
  if (!value || !value.trim()) {
    return { shouldPivot: false, blockedTopics: [], pivotStrength: "none" };
  }

  const normalized = value.trim();
  const hardPivot = HARD_PIVOT_PATTERN.test(normalized);
  const softPivot = SOFT_PIVOT_PATTERN.test(normalized);

  if (!hardPivot && !softPivot) {
    return { shouldPivot: false, blockedTopics: [], pivotStrength: "none" };
  }

  return {
    shouldPivot: true,
    blockedTopics: extractBlockedTopics(normalized),
    pivotStrength: hardPivot ? "hard" : "soft",
  };
}

export function buildPivotRule(pivot: ConversationPivot): string {
  if (!pivot.shouldPivot) {
    return "";
  }

  if (pivot.blockedTopics.length > 0) {
    return `\n- Le user a explicitement demande de pivoter. Interdit de relancer ces sujets: ${pivot.blockedTopics.join(", ")}.`;
  }

  return "\n- Le user a explicitement demande de changer de sujet. Tu dois pivoter franchement et ne pas revenir sur le theme precedent dans ce message.";
}

function mentionsBlockedTopic(content: string, blockedTopics: string[] = []): boolean {
  const normalizedContent = normalizeBlockedTopic(content);
  return blockedTopics.some((topic) => topic && normalizedContent.includes(topic));
}

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

export function buildConversationFallback(options: NormalizeConversationOptions): string {
  const variants = getFallbackOptions(options.mode, options, options.userMessage);
  const seed = [
    options.agentName,
    options.personalityPrimary,
    options.personalityNuance,
    options.userMessage,
    options.mode,
  ]
    .filter(Boolean)
    .join("|");

  return sanitizeFallback(pickVariant(variants, seed));
}

export function getConversationFallbackKey(options: NormalizeConversationOptions): string {
  return `${options.mode}:${getVoiceKey(options)}`;
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

export function normalizeConversationMessageResult(
  content: string,
  options: NormalizeConversationOptions
): ConversationNormalizationResult {
  const { mode, userMessage, blockedTopics = [] } = options;
  const limits = getModeLimits(mode);
  const fallback = (): ConversationNormalizationResult => ({
    message: buildConversationFallback(options),
    usedFallback: true,
    fallbackKey: getConversationFallbackKey(options),
  });

  const cleaned = stripStageDirections(stripPlaceholders(stripFormatting(content)));
  const bubbles = cleaned
    .split("|||")
    .map((bubble) => trimToCharCount(trimToSentenceCount(bubble.trim(), limits.maxSentences), limits.maxChars))
    .filter(Boolean)
    .slice(0, limits.maxBubbles);

  let normalized = bubbles.join(" ||| ").trim();
  if (!normalized) {
    return fallback();
  }

  if (!userTriggeredProfessionalTopic(userMessage) && mode === "nudge" && TECHNICAL_TOPIC_PATTERN.test(normalized)) {
    return fallback();
  }

  if (PLACEHOLDER_PATTERN.test(normalized)) {
    return fallback();
  }

  if ((mode === "nudge" || mode === "discovery") && PSEUDO_NARRATIVE_OPENING_PATTERN.test(normalized)) {
    return fallback();
  }

  if (mode === "reply" && THIN_REPLY_PATTERN.test(normalized)) {
    return fallback();
  }

  if (blockedTopics.length > 0 && mentionsBlockedTopic(normalized, blockedTopics)) {
    return fallback();
  }

  normalized = normalized.replace(/\s+\|\|\|\s+/g, " ||| ").trim();
  if (!normalized) {
    return fallback();
  }

  return {
    message: normalized,
    usedFallback: false,
    fallbackKey: null,
  };
}

export function normalizeConversationMessage(
  content: string,
  options: NormalizeConversationOptions
): string {
  return normalizeConversationMessageResult(content, options).message;
}