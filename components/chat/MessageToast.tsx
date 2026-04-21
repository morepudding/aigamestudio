"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useChatPanel } from "./ChatPanelProvider";
import { MessageCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";

interface ToastEntry {
  id: number;
  agentSlug: string;
  agentName: string;
  iconUrl: string | null;
  count: number;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function MessageToast() {
  const { waitingAgents, newMessageTick, openChat, unreadCount } = useChatPanel();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const toastIdRef = useRef(0);
  const pathname = usePathname();
  const isChatRoute = pathname.startsWith("/chat");
  const prevTickRef = useRef(0);

  useEffect(() => {
    // Only fire when tick increments (new messages detected) and user is not on chat route
    if (newMessageTick === 0 || newMessageTick === prevTickRef.current) return;
    if (isChatRoute) { prevTickRef.current = newMessageTick; return; }

    prevTickRef.current = newMessageTick;

    if (!waitingAgents.length) return;

    // Group: show max 2 toasts at once
    const toShow = waitingAgents.slice(0, 2);
    const newToasts: ToastEntry[] = toShow.map((agent) => ({
      id: ++toastIdRef.current,
      agentSlug: agent.slug,
      agentName: agent.name,
      iconUrl: agent.iconUrl,
      count: unreadCount,
    }));

    setToasts((prev) => [...prev, ...newToasts].slice(-3));

    // Auto-dismiss after 5s
    const ids = newToasts.map((t) => t.id);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !ids.includes(t.id)));
    }, 5000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMessageTick]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-20 md:bottom-24 right-4 md:right-6 z-[60] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-4 duration-300 max-w-xs"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-primary/30 flex items-center justify-center">
            {toast.iconUrl ? (
              <Image src={toast.iconUrl} alt={toast.agentName} width={36} height={36} unoptimized className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white">{getInitials(toast.agentName)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white leading-none mb-0.5">{toast.agentName}</p>
            <p className="text-[11px] text-amber-300/80 leading-none">t&apos;a envoyé un message</p>
          </div>
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={() => openChat(toast.agentSlug)}
              className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
              title="Ouvrir"
            >
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
            </button>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="p-1.5 rounded-lg hover:bg-white/8 transition-colors"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5 text-white/30" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
