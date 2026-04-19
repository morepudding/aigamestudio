"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getUnreadCount } from "@/lib/services/chatService";

interface ChatPanelContextType {
  isOpen: boolean;
  activeAgentSlug: string | null;
  unreadCount: number;
  shouldRenderPanel: boolean;
  openChat: (agentSlug: string) => void;
  openHub: () => void;
  closeChat: () => void;
  toggleChat: (agentSlug?: string) => void;
  primeChatPanel: () => void;
}

const ChatPanelContext = createContext<ChatPanelContextType>({
  isOpen: false,
  activeAgentSlug: null,
  unreadCount: 0,
  shouldRenderPanel: false,
  openChat: () => {},
  openHub: () => {},
  closeChat: () => {},
  toggleChat: () => {},
  primeChatPanel: () => {},
});

export function useChatPanel() {
  return useContext(ChatPanelContext);
}

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeAgentSlug, setActiveAgentSlug] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shouldRenderPanel, setShouldRenderPanel] = useState(false);

  const primeChatPanel = useCallback(() => {
    setShouldRenderPanel(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canPollContinuously = !isOpen && !pathname.startsWith("/chat");

    async function refreshUnreadCount(force = false) {
      if (!force && typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const count = await getUnreadCount();
      if (!cancelled) setUnreadCount(count);
    }

    void refreshUnreadCount(true);

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refreshUnreadCount(true);
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = canPollContinuously
      ? setInterval(() => {
          void refreshUnreadCount(false);
        }, 15000)
      : null;

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (interval) clearInterval(interval);
    };
  }, [isOpen, pathname]);

  const openChat = useCallback((agentSlug: string) => {
    primeChatPanel();
    setActiveAgentSlug(agentSlug);
    setIsOpen(true);
  }, [primeChatPanel]);

  const openHub = useCallback(() => {
    primeChatPanel();
    setActiveAgentSlug(null);
    setIsOpen(true);
  }, [primeChatPanel]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback((agentSlug?: string) => {
    primeChatPanel();
    if (agentSlug && agentSlug !== activeAgentSlug) {
      setActiveAgentSlug(agentSlug);
      setIsOpen(true);
    } else if (!agentSlug && !activeAgentSlug) {
      // Toggle hub mode
      setIsOpen((prev) => !prev);
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [activeAgentSlug, primeChatPanel]);

  return (
    <ChatPanelContext.Provider value={{ isOpen, activeAgentSlug, unreadCount, shouldRenderPanel, openChat, openHub, closeChat, toggleChat, primeChatPanel }}>
      {children}
    </ChatPanelContext.Provider>
  );
}
