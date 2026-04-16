"use client";

import Image from "next/image";
import { ReactNode } from "react";

export type Mood =
  | "neutre"
  | "enthousiaste"
  | "frustré"
  | "curieux"
  | "fier"
  | "inquiet"
  | "joueur"
  | "nostalgique"
  | "inspiré"
  | "agacé";

interface MoodConfig {
  gradient: string;
  glow: string;
  pulse: string;
  intensity: "low" | "medium" | "high";
}

const moodStyles: Record<Mood, MoodConfig> = {
  neutre: {
    gradient: "from-gray-400 via-slate-500 to-gray-400",
    glow: "shadow-gray-500/20",
    pulse: "animate-pulse-slow",
    intensity: "low",
  },
  enthousiaste: {
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    glow: "shadow-amber-500/40",
    pulse: "animate-pulse-fast",
    intensity: "high",
  },
  frustré: {
    gradient: "from-red-500 via-rose-600 to-red-500",
    glow: "shadow-red-500/50",
    pulse: "animate-pulse-erratic",
    intensity: "high",
  },
  curieux: {
    gradient: "from-blue-400 via-cyan-500 to-blue-400",
    glow: "shadow-cyan-500/30",
    pulse: "animate-pulse-medium",
    intensity: "medium",
  },
  fier: {
    gradient: "from-emerald-400 via-green-500 to-emerald-400",
    glow: "shadow-emerald-500/40",
    pulse: "animate-pulse-proud",
    intensity: "medium",
  },
  inquiet: {
    gradient: "from-orange-400 via-amber-600 to-orange-400",
    glow: "shadow-orange-500/30",
    pulse: "animate-pulse-nervous",
    intensity: "medium",
  },
  joueur: {
    gradient: "from-purple-400 via-fuchsia-500 to-pink-500",
    glow: "shadow-purple-500/40",
    pulse: "animate-pulse-playful",
    intensity: "high",
  },
  nostalgique: {
    gradient: "from-pink-400 via-rose-400 to-pink-300",
    glow: "shadow-pink-400/30",
    pulse: "animate-pulse-slow",
    intensity: "low",
  },
  inspiré: {
    gradient: "from-cyan-400 via-teal-400 to-emerald-400",
    glow: "shadow-teal-400/40",
    pulse: "animate-pulse-sparkle",
    intensity: "high",
  },
  agacé: {
    gradient: "from-amber-500 via-orange-500 to-amber-500",
    glow: "shadow-amber-500/30",
    pulse: "animate-pulse-erratic",
    intensity: "medium",
  },
};

interface MoodRingProps {
  mood?: Mood | string | null;
  size?: "sm" | "md" | "lg" | "xl";
  children?: ReactNode;
  // For avatar rendering
  imageUrl?: string | null;
  fallbackGradient?: string;
  initials?: string;
  showOnlineIndicator?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { ring: "w-8 h-8", avatar: "w-7 h-7", indicator: "w-2 h-2 -bottom-0.5 -right-0.5", border: "2" },
  md: { ring: "w-10 h-10", avatar: "w-9 h-9", indicator: "w-2.5 h-2.5 -bottom-0.5 -right-0.5", border: "2" },
  lg: { ring: "w-12 h-12", avatar: "w-11 h-11", indicator: "w-3 h-3 -bottom-0.5 -right-0.5", border: "2" },
  xl: { ring: "w-16 h-16", avatar: "w-14 h-14", indicator: "w-3.5 h-3.5 -bottom-1 -right-1", border: "3" },
};

export function MoodRing({
  mood,
  size = "md",
  children,
  imageUrl,
  fallbackGradient = "from-gray-500 to-gray-600",
  initials = "?",
  showOnlineIndicator = true,
  className = "",
}: MoodRingProps) {
  const moodKey = (mood && mood in moodStyles ? mood : "neutre") as Mood;
  const config = moodStyles[moodKey];
  const sizes = sizeClasses[size];

  return (
    <div className={`relative ${className}`}>
      {/* Outer glow layer */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-r ${config.gradient} blur-md opacity-60 ${config.pulse} ${config.glow}`}
        style={{ transform: "scale(1.15)" }}
      />

      {/* Animated gradient ring */}
      <div
        className={`relative ${sizes.ring} rounded-full p-[${sizes.border}px] bg-gradient-to-r ${config.gradient} ${config.pulse} shadow-lg ${config.glow}`}
        style={{
          background: `linear-gradient(var(--angle, 0deg), var(--tw-gradient-stops))`,
          animation: `spin-gradient 3s linear infinite, ${config.intensity === "high" ? "pulse-ring 1.5s ease-in-out infinite" : config.intensity === "medium" ? "pulse-ring 2.5s ease-in-out infinite" : "pulse-ring 4s ease-in-out infinite"}`,
        }}
      >
        {/* Inner container */}
        <div className={`${sizes.avatar} rounded-full bg-background flex items-center justify-center overflow-hidden`}>
          {children ? (
            children
          ) : imageUrl ? (
            <Image
              src={imageUrl}
              alt="Avatar"
              width={64}
              height={64}
              unoptimized
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex items-center justify-center text-white font-bold ${size === "sm" ? "text-xs" : size === "md" ? "text-xs" : size === "lg" ? "text-sm" : "text-base"}`}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Online indicator */}
      {showOnlineIndicator && (
        <div
          className={`absolute ${sizes.indicator} rounded-full bg-emerald-500 border-2 border-background z-10`}
          style={{
            boxShadow: "0 0 8px rgba(16, 185, 129, 0.6)",
          }}
        />
      )}
    </div>
  );
}

// Utility component for simple mood indicator dot
export function MoodDot({ mood, size = "sm" }: { mood?: Mood | string | null; size?: "sm" | "md" }) {
  const moodKey = (mood && mood in moodStyles ? mood : "neutre") as Mood;
  const config = moodStyles[moodKey];
  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  return (
    <span
      className={`inline-block ${dotSize} rounded-full bg-gradient-to-r ${config.gradient} ${config.pulse}`}
      style={{
        boxShadow: `0 0 8px currentColor`,
      }}
    />
  );
}
