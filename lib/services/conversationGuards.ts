import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_CONSECUTIVE_AGENT_MESSAGES = 2;

type MessageSenderRow = {
  sender: "user" | "agent";
};

export async function countTrailingAgentMessages(
  client: SupabaseClient,
  conversationId: string,
  maxToInspect = MAX_CONSECUTIVE_AGENT_MESSAGES,
): Promise<number> {
  const { data, error } = await client
    .from("messages")
    .select("sender")
    .eq("conversation_id", conversationId)
    .order("timestamp", { ascending: false })
    .limit(maxToInspect);

  if (error || !data?.length) {
    return 0;
  }

  let consecutiveAgentMessages = 0;

  for (const row of data as MessageSenderRow[]) {
    if (row.sender !== "agent") {
      break;
    }

    consecutiveAgentMessages += 1;
  }

  return consecutiveAgentMessages;
}

export async function canSendAgentMessage(
  client: SupabaseClient,
  conversationId: string,
  maxConsecutiveAgentMessages = MAX_CONSECUTIVE_AGENT_MESSAGES,
): Promise<boolean> {
  const consecutiveAgentMessages = await countTrailingAgentMessages(
    client,
    conversationId,
    maxConsecutiveAgentMessages,
  );

  return consecutiveAgentMessages < maxConsecutiveAgentMessages;
}