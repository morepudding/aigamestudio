"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  placeholder = "Écrire un message…",
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Re-focus after send
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-white/[0.06] bg-background/80 backdrop-blur-xl p-3 md:p-4">
      <div className="flex items-end gap-2 md:gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 focus-within:border-primary/30 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-muted-foreground/40 resize-none outline-none max-h-40 scrollbar-none"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={`w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
            value.trim()
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95"
              : "bg-white/[0.06] text-muted-foreground/30 cursor-not-allowed"
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="hidden md:block text-[10px] text-muted-foreground/30 text-center mt-2">
        Entrée pour envoyer · Shift+Entrée pour un retour à la ligne
      </p>
    </div>
  );
}
