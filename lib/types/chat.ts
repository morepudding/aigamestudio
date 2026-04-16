export type MessageType = "normal" | "discovery" | "moment_vivant";

export interface Message {
  id: string;
  conversationId: string;
  sender: "user" | "agent";
  content: string;
  timestamp: number;
  messageType: MessageType;
}

export interface Conversation {
  id: string;
  agentSlug: string;
  isPinned: boolean;
  awaitingUserReply: boolean;
  discoveryRhythm: number;
  messageCount: number;
  messages: Message[];
  lastMessageAt: number;
  createdAt: number;
}
