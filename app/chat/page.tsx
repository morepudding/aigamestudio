import { ChatHubPageClient } from "@/components/chat/ChatHubPageClient";
import { getConversationSummaries } from "@/lib/services/chatService";
import { getAllAgents } from "@/lib/services/agentService";
import { startTimer } from "@/lib/utils/perf";

export const revalidate = 10;

export default async function ChatPage() {
  const stop = startTimer("ChatPage/load");
  const [agents, conversations] = await Promise.all([getAllAgents(), getConversationSummaries()]);
  stop({ agents: agents.length, conversations: conversations.length });

  return <ChatHubPageClient initialAgents={agents} initialConversations={conversations} />;
}
