// LLM models and configuration for Eden Studio
// Chat: DeepSeek V3 (fast, personality-driven)
// Tasks/Docs: DeepSeek V3 (high quality, structured output)
// Code: DeepSeek V3 (agentic coding loop with tool calling)

export const LLM_MODELS = {
  chat: "deepseek/deepseek-chat-v3-0324",
  tasks: "deepseek/deepseek-chat-v3-0324",
  // Upgrade to "anthropic/claude-sonnet-4" for complex codebases
  code: "deepseek/deepseek-chat-v3-0324",
} as const;

export type LLMModel = (typeof LLM_MODELS)[keyof typeof LLM_MODELS];

export const LLM_PARAMS = {
  chat: {
    temperature: 0.8,
    max_tokens: 300,
  },
  tasks: {
    temperature: 0.4,
    max_tokens: 4096,
  },
  code: {
    temperature: 0.2,
    max_tokens: 8192,
  },
} as const;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number | null;
}

// Tool calling types (OpenAI function calling format, supported by OpenRouter)
export interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Tool {
  type: "function";
  function: ToolFunction;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AgentResponse {
  choices: Array<{
    message: AgentMessage;
    finish_reason: string;
  }>;
  tokensUsed: number | null;
}

/**
 * Centralized OpenRouter API call.
 * Reads OPENROUTER_API_KEY from environment variables.
 */
export async function callOpenRouter(
  model: string,
  messages: LLMMessage[],
  params?: { temperature?: number; max_tokens?: number }
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not defined");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Eden Studio",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: params?.temperature,
      max_tokens: params?.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed: number | null = data.usage?.total_tokens ?? null;

  return { content, tokensUsed };
}

/**
 * OpenRouter API call with tool calling support (agentic loop).
 * Returns the full choices array so the caller can inspect tool_calls.
 */
export async function callOpenRouterWithTools(
  model: string,
  messages: AgentMessage[],
  tools: Tool[],
  params?: { temperature?: number; max_tokens?: number },
  signal?: AbortSignal
): Promise<AgentResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not defined");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Eden Studio",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      temperature: params?.temperature,
      max_tokens: params?.max_tokens,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return {
    choices: data.choices ?? [],
    tokensUsed: data.usage?.total_tokens ?? null,
  };
}
