"use client";

import { MessageCircle } from "lucide-react";
import { useChatPanel } from "./ChatPanelProvider";

export function ChatBubble() {
  const { isOpen, openHub, closeChat, unreadCount, primeChatPanel } = useChatPanel();

  function handleClick() {
    if (isOpen) {
      closeChat();
    } else {
      openHub();
    }
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={primeChatPanel}
      onFocus={primeChatPanel}
      onTouchStart={primeChatPanel}
      className="hidden md:flex fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 group"
      title="Ouvrir les messages"
      aria-label="Ouvrir les messages"
    >
      <MessageCircle className="w-6 h-6 text-primary-foreground" />

      {/* Notification badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 border-2 border-background flex items-center justify-center text-[10px] font-bold text-white leading-none">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
