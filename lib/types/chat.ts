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
  nudgeCount: number;
  nudgeScheduledAt: number | null;
}

/** Version allégée pour le hub — ne contient pas l'historique complet */
export interface ConversationSummary {
  id: string;
  agentSlug: string;
  awaitingUserReply: boolean;
  discoveryCount: number;
  lastMessage: {
    sender: "user" | "agent";
    content: string;
    messageType: MessageType;
  } | null;
  lastMessageAt: number;
}
