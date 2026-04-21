"use client";

import { MessageCircle } from "lucide-react";
import Image from "next/image";
import { useChatPanel } from "./ChatPanelProvider";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function truncate(str: string, max: number) {
  return str.length <= max ? str : str.slice(0, max) + "…";
}

export function ChatBubble() {
  const { isOpen, openHub, openChat, closeChat, unreadCount, waitingAgents, primeChatPanel } = useChatPanel();

  const showPreview = unreadCount > 0 && !isOpen && waitingAgents.length > 0;

  function handleClick() {
    if (isOpen) {
      closeChat();
    } else {
      openHub();
    }
  }

  return (
    <div className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-end gap-2">
      {/* Agent preview cards — appear above the bubble when unread messages */}
      {showPreview && (
        <div className="flex flex-col gap-1.5 items-end mb-1">
          {waitingAgents.slice(0, 3).map((agent) => (
            <button
              key={agent.slug}
              onClick={() => openChat(agent.slug)}
              className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-white/20 hover:bg-card transition-all duration-200 text-left max-w-[260px] animate-in slide-in-from-right-2 duration-300"
            >
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/30 flex items-center justify-center">
                  {agent.iconUrl ? (
                    <Image
                      src={agent.iconUrl}
                      alt={agent.name}
                      width={36}
                      height={36}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-white">{getInitials(agent.name)}</span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-[1.5px] border-background animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white leading-none mb-0.5">{agent.name}</p>
                {agent.lastMessage ? (
                  <p className="text-[11px] text-muted-foreground/70 leading-snug truncate">
                    {truncate(agent.lastMessage, 38)}
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-400/60 leading-none">t&apos;a écrit</p>
                )}
              </div>
            </button>
          ))}
          {waitingAgents.length > 3 && (
            <button
              onClick={openHub}
              className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground/80 pr-2 transition-colors"
            >
              +{waitingAgents.length - 3} autre{waitingAgents.length - 3 > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={handleClick}
        onMouseEnter={primeChatPanel}
        onFocus={primeChatPanel}
        onTouchStart={primeChatPanel}
        className={`relative flex w-14 h-14 rounded-full items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
          unreadCount > 0 && !isOpen
            ? "bg-primary shadow-primary/40"
            : "bg-primary shadow-primary/30"
        }`}
        title="Ouvrir les messages"
        aria-label="Ouvrir les messages"
      >
        {/* Avatar stack on bubble when agents are waiting */}
        {showPreview && waitingAgents.length === 1 ? (
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/60 flex items-center justify-center">
            {waitingAgents[0].iconUrl ? (
              <Image
                src={waitingAgents[0].iconUrl}
                alt={waitingAgents[0].name}
                width={32}
                height={32}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold text-white">{getInitials(waitingAgents[0].name)}</span>
            )}
          </div>
        ) : showPreview && waitingAgents.length > 1 ? (
          <div className="flex -space-x-2">
            {waitingAgents.slice(0, 2).map((agent) => (
              <div
                key={agent.slug}
                className="w-6 h-6 rounded-full overflow-hidden border-[1.5px] border-primary bg-primary/60 flex items-center justify-center flex-shrink-0"
              >
                {agent.iconUrl ? (
                  <Image src={agent.iconUrl} alt={agent.name} width={24} height={24} unoptimized className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[8px] font-bold text-white">{getInitials(agent.name)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        )}

        {/* Notification badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 border-2 border-background flex items-center justify-center text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
