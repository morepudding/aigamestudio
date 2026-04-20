"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getUnreadCount } from "@/lib/services/chatService";
import { supabase } from "@/lib/supabase/client";

export interface WaitingAgent {
  slug: string;
  name: string;
  iconUrl: string | null;
  mood: string | null;
}

interface ChatPanelContextType {
  isOpen: boolean;
  activeAgentSlug: string | null;
  unreadCount: number;
  shouldRenderPanel: boolean;
  waitingAgents: WaitingAgent[];
  newMessageTick: number;
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
  waitingAgents: [],
  newMessageTick: 0,
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
  const [waitingAgents, setWaitingAgents] = useState<WaitingAgent[]>([]);
  const [newMessageTick, setNewMessageTick] = useState(0);
  const prevUnreadRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const primeChatPanel = useCallback(() => {
    setShouldRenderPanel(true);
  }, []);

  const refreshWaitingAgents = useCallback(async () => {
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("agent_slug")
        .eq("awaiting_user_reply", true);

      if (!convs?.length) {
        setWaitingAgents([]);
        return;
      }

      const slugs = convs.map((c: { agent_slug: string }) => c.agent_slug);
      const { data: agents } = await supabase
        .from("agents")
        .select("slug, name, icon_url, mood")
        .in("slug", slugs);

      setWaitingAgents(
        (agents ?? []).map((a: { slug: string; name: string; icon_url: string | null; mood: string | null }) => ({
          slug: a.slug,
          name: a.name,
          iconUrl: a.icon_url ?? null,
          mood: a.mood ?? null,
        }))
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canPollContinuously = !isOpen && !pathname.startsWith("/chat");

    async function runDueNudges() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      try {
        await fetch("/api/ai/nudge", { method: "POST" });
      } catch {
        // ignore
      }
    }

    async function refreshUnreadCount(force = false) {
      if (!force && typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const count = await getUnreadCount();
      if (!cancelled) {
        setUnreadCount(count);
        const prev = prevUnreadRef.current;
        if (prev === null) {
          // Initial load — fetch agents if unread, but no toast
          if (count > 0) void refreshWaitingAgents();
        } else if (count > prev && !isOpenRef.current) {
          // New messages arrived while user is away from chat
          setNewMessageTick((t) => t + 1);
          void refreshWaitingAgents();
        } else if (count === 0) {
          setWaitingAgents([]);
        }
        prevUnreadRef.current = count;
      }
    }

    void runDueNudges().then(() => refreshUnreadCount(true));

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void runDueNudges().then(() => refreshUnreadCount(true));
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = canPollContinuously
      ? setInterval(() => {
          void refreshUnreadCount(false);
        }, 15000)
      : null;

    const nudgeInterval = setInterval(() => {
      void runDueNudges().then(() => refreshUnreadCount(false));
    }, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (interval) clearInterval(interval);
      clearInterval(nudgeInterval);
    };
  }, [isOpen, pathname, refreshWaitingAgents]);

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
    <ChatPanelContext.Provider value={{ isOpen, activeAgentSlug, unreadCount, shouldRenderPanel, waitingAgents, newMessageTick, openChat, openHub, closeChat, toggleChat, primeChatPanel }}>
      {children}
    </ChatPanelContext.Provider>
  );
}
