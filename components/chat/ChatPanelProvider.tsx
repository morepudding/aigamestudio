"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { getUnreadCount } from "@/lib/services/chatService";

interface ChatPanelContextType {
  isOpen: boolean;
  activeAgentSlug: string | null;
  unreadCount: number;
  openChat: (agentSlug: string) => void;
  openHub: () => void;
  closeChat: () => void;
  toggleChat: (agentSlug?: string) => void;
}

const ChatPanelContext = createContext<ChatPanelContextType>({
  isOpen: false,
  activeAgentSlug: null,
  unreadCount: 0,
  openChat: () => {},
  openHub: () => {},
  closeChat: () => {},
  toggleChat: () => {},
});

export function useChatPanel() {
  return useContext(ChatPanelContext);
}

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAgentSlug, setActiveAgentSlug] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread count every 5s
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const count = await getUnreadCount();
      if (!cancelled) setUnreadCount(count);
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const openChat = useCallback((agentSlug: string) => {
    setActiveAgentSlug(agentSlug);
    setIsOpen(true);
  }, []);

  const openHub = useCallback(() => {
    setActiveAgentSlug(null);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback((agentSlug?: string) => {
    if (agentSlug && agentSlug !== activeAgentSlug) {
      setActiveAgentSlug(agentSlug);
      setIsOpen(true);
    } else if (!agentSlug && !activeAgentSlug) {
      // Toggle hub mode
      setIsOpen((prev) => !prev);
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [activeAgentSlug]);

  return (
    <ChatPanelContext.Provider value={{ isOpen, activeAgentSlug, unreadCount, openChat, openHub, closeChat, toggleChat }}>
      {children}
    </ChatPanelContext.Provider>
  );
}
