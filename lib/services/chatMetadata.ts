export type MessageGenerationKind = "welcome" | "reply" | "discovery" | "nudge";

export type MessageGenerationSource =
  | "welcome"
  | "standard_reply"
  | "memory_interview"
  | "topic_reservoir"
  | "seed_nudge"
  | "fallback";

export interface MessageGenerationTrace {
  kind: MessageGenerationKind;
  source: MessageGenerationSource;
  scenarioId?: number | null;
  scenarioTitle?: string | null;
  promptVariant?: string | null;
  fallbackKey?: string | null;
  pivotDetected?: boolean;
  blockedTopics?: string[];
  feedbackSignal?: {
    hasSignal: boolean;
    thumbsUpCount: number;
    thumbsDownCount: number;
  } | null;
  selectedAt: number;
}

export interface MessageMetadata {
  trace?: MessageGenerationTrace;
}

export interface ConversationMetadata {
  lastReadAt?: number;
  usedScenarioIds?: number[];
  lastScenarioAt?: number | null;
  lastAgentTrace?: MessageGenerationTrace;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeConversationMetadata(value: unknown): ConversationMetadata {
  if (!isRecord(value)) {
    return {};
  }
  return { ...value } as ConversationMetadata;
}

export function normalizeMessageMetadata(value: unknown): MessageMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return { ...value } as MessageMetadata;
}

export function buildMessageTrace(
  kind: MessageGenerationKind,
  source: MessageGenerationSource,
  options: {
    scenarioId?: number | null;
    scenarioTitle?: string | null;
    promptVariant?: string | null;
    fallbackKey?: string | null;
    pivotDetected?: boolean;
    blockedTopics?: string[];
    feedbackSignal?: {
      hasSignal: boolean;
      thumbsUpCount: number;
      thumbsDownCount: number;
    } | null;
    selectedAt?: number;
  } = {}
): MessageGenerationTrace {
  return {
    kind,
    source,
    scenarioId: options.scenarioId ?? null,
    scenarioTitle: options.scenarioTitle ?? null,
    promptVariant: options.promptVariant ?? null,
    fallbackKey: options.fallbackKey ?? null,
    pivotDetected: options.pivotDetected ?? false,
    blockedTopics: options.blockedTopics ?? [],
    feedbackSignal: options.feedbackSignal ?? null,
    selectedAt: options.selectedAt ?? Date.now(),
  };
}

export function buildMessageMetadata(trace: MessageGenerationTrace): MessageMetadata {
  return { trace };
}

export function getUsedScenarioIdsFromMetadata(value: unknown): number[] {
  const metadata = normalizeConversationMetadata(value);
  return Array.isArray(metadata.usedScenarioIds)
    ? metadata.usedScenarioIds.filter((id): id is number => typeof id === "number")
    : [];
}

export function recordScenarioUsage(
  value: unknown,
  scenarioId: number,
  timestamp = Date.now()
): ConversationMetadata {
  const metadata = normalizeConversationMetadata(value);
  const existingIds = getUsedScenarioIdsFromMetadata(metadata);

  return {
    ...metadata,
    usedScenarioIds: [...existingIds, scenarioId].slice(-5),
    lastScenarioAt: timestamp,
  };
}

export function mergeAgentTraceIntoConversationMetadata(
  value: unknown,
  trace: MessageGenerationTrace
): ConversationMetadata {
  const metadata = normalizeConversationMetadata(value);
  const nextMetadata: ConversationMetadata = {
    ...metadata,
    lastAgentTrace: trace,
  };

  if (typeof trace.scenarioId === "number") {
    return recordScenarioUsage(nextMetadata, trace.scenarioId, trace.selectedAt);
  }

  return nextMetadata;
}