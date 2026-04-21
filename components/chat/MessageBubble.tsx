"use client";

import Image from "next/image";
import { Message } from "@/lib/types/chat";
import { useEffect, useRef, useState } from "react";
import { Brain, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { parseEmotion, joyeuseEmoji } from "@/lib/utils/emotion";

interface MessageBubbleProps {
  message: Message;
  agentName: string;
  agentInitials: string;
  agentIconUrl?: string | null;
  gradient: string;
  onRateMessage?: (messageId: string, feedback: 1 | -1 | null) => Promise<void> | void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

export function DateSeparator({ timestamp }: { timestamp: number }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-white/5" />
      <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
        {formatDate(timestamp)}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

export function MessageBubble({
  message,
  agentName,
  agentInitials,
  agentIconUrl,
  gradient,
  onRateMessage,
}: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const ref = useRef<HTMLDivElement>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const { text, emotion, emotionType } = isUser
    ? { text: message.content, emotion: null, emotionType: null as null }
    : parseEmotion(message.content);

  const currentFeedback = message.userFeedback ?? null;

  const handleFeedback = async (feedback: 1 | -1) => {
    if (!onRateMessage || isUser || isSubmittingFeedback) return;
    const nextFeedback = currentFeedback === feedback ? null : feedback;
    setIsSubmittingFeedback(true);
    try {
      await onRateMessage(message.id, nextFeedback);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    if (ref.current) {
      ref.current.style.opacity = "0";
      ref.current.style.transform = isUser
        ? "translateX(12px)"
        : "translateX(-12px)";
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.style.transition =
            "opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
          ref.current.style.opacity = "1";
          ref.current.style.transform = "translateX(0)";
        }
      });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={`flex items-end gap-2 md:gap-2.5 max-w-[90%] md:max-w-[80%] ${
        isUser ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {/* Avatar — only for agent */}
      {!isUser && (
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-lg overflow-hidden`}
          title={agentName}
        >
          {agentIconUrl ? (
            <Image
              src={agentIconUrl}
              alt={agentName}
              width={32}
              height={32}
              unoptimized
              className="w-full h-full object-cover"
            />
          ) : (
            agentInitials
          )}
        </div>
      )}

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Manga floating bubble — intense/dramatic emotions */}
        {!isUser && emotionType === "intense" && emotion && (
          <div className="self-start mb-1 ml-1 px-2.5 py-1 rounded-xl rounded-bl-none bg-red-950/70 border border-red-700/40 text-red-300/80 text-[10px] italic font-medium shadow-lg shadow-red-900/20 max-w-50 leading-snug">
            {emotion}
          </div>
        )}
        <div
          className={`relative px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md shadow-lg shadow-primary/20"
              : message.messageType === "discovery"
              ? "bg-violet-500/[0.08] text-violet-300 rounded-bl-md border border-violet-500/20"
              : message.messageType === "moment_vivant"
              ? "bg-amber-500/8 text-amber-200 rounded-bl-md border border-amber-500/20"
              : "bg-white/[0.06] text-white/90 rounded-bl-md border border-white/[0.06]"
          }`}
        >
          {!isUser && message.messageType === "discovery" && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-violet-400/80 mb-1.5 -mt-0.5">
              <Brain className="w-3 h-3" />
              Découverte
            </span>
          )}
          {!isUser && message.messageType === "moment_vivant" && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400/80 mb-1.5 -mt-0.5">
              <Sparkles className="w-3 h-3" />
              Moment Vivant
            </span>
          )}
          {/* Joyeuse: emoji badge top-right corner */}
          {!isUser && emotionType === "joyeuse" && emotion && (
            <span
              className="absolute -top-3 -right-2 text-base select-none"
              title={emotion}
            >
              {joyeuseEmoji(emotion)}
            </span>
          )}
          {text}
        </div>
        {/* Subtile: italic bandeau below bubble */}
        {!isUser && emotionType === "subtile" && emotion && (
          <p className="mt-1 ml-1 text-[10px] italic text-white/25 leading-snug max-w-60">
            {emotion}
          </p>
        )}
        <div className={`mt-1 flex items-center gap-2 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-muted-foreground/40">
            {formatTime(message.timestamp)}
          </span>
          {!isUser && onRateMessage && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleFeedback(1)}
                disabled={isSubmittingFeedback}
                className={`rounded-md p-1 transition-colors ${
                  currentFeedback === 1
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-muted-foreground/35 hover:bg-white/5 hover:text-white/60"
                } disabled:opacity-50`}
                aria-label="Pouce haut"
                title="Pouce haut"
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => void handleFeedback(-1)}
                disabled={isSubmittingFeedback}
                className={`rounded-md p-1 transition-colors ${
                  currentFeedback === -1
                    ? "bg-rose-500/15 text-rose-400"
                    : "text-muted-foreground/35 hover:bg-white/5 hover:text-white/60"
                } disabled:opacity-50`}
                aria-label="Pouce bas"
                title="Pouce bas"
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
