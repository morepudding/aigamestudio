"use client";

import { MoodRing, type Mood } from "@/components/ui/MoodRing";
import { DeskMarker } from "@/components/office/DeskMarker";
import { DeptIcon } from "@/components/ui/DeptIcon";
import { useChatPanel } from "@/components/chat/ChatPanelProvider";
import { useState } from "react";

const departmentGradients: Record<string, string> = {
  art: "from-pink-500 to-rose-600",
  programming: "from-cyan-500 to-blue-600",
  "game-design": "from-amber-500 to-orange-600",
  audio: "from-violet-500 to-purple-600",
  narrative: "from-emerald-500 to-teal-600",
  qa: "from-lime-500 to-green-600",
  marketing: "from-red-500 to-pink-600",
  production: "from-indigo-500 to-blue-600",
};

// Maps department to a DeskMarker color
const departmentMarkerColors: Record<string, string> = {
  art: "bg-pink-500",
  programming: "bg-cyan-500",
  "game-design": "bg-amber-500",
  audio: "bg-violet-500",
  narrative: "bg-emerald-500",
  qa: "bg-lime-500",
  marketing: "bg-red-500",
  production: "bg-indigo-500",
};

interface AgentDeskSpotProps {
  slug: string;
  name: string;
  role: string;
  department: string;
  mood?: string | null;
  iconUrl?: string | null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AgentDeskSpot({
  slug,
  name,
  role,
  department,
  mood,
  iconUrl,
}: AgentDeskSpotProps) {
  const { openChat } = useChatPanel();
  const [hovered, setHovered] = useState(false);

  const gradient = departmentGradients[department] ?? "from-gray-500 to-gray-600";
  const markerColor = departmentMarkerColors[department] ?? "bg-primary";

  return (
    <button
      onClick={() => openChat(slug)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center group focus:outline-none"
      title={`${name} — ${role}`}
    >
      {/* Tooltip */}
      {hovered && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-background/90 backdrop-blur border border-white/10 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap">
            <div className="flex items-center gap-1.5 mb-0.5">
              <DeptIcon department={department} size={12} />
              <span className="text-xs font-semibold text-foreground">{name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{role}</p>
            {mood && (
              <p className="text-xs text-primary mt-0.5 capitalize">{mood}</p>
            )}
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-background/90 border-b border-r border-white/10 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {/* MoodRing avatar */}
      <div className={`transition-transform duration-200 ${hovered ? "scale-110 -translate-y-1" : ""}`}>
        <MoodRing
          mood={mood as Mood}
          size="lg"
          imageUrl={iconUrl}
          fallbackGradient={gradient}
          initials={getInitials(name)}
          showOnlineIndicator={true}
        />
      </div>

      {/* Name label */}
      <span
        className={`mt-1.5 text-xs font-medium px-1.5 py-0.5 rounded-full transition-all duration-200 ${
          hovered
            ? "bg-white/15 text-white"
            : "bg-black/40 text-white/60"
        }`}
      >
        {name.split(" ")[0]}
      </span>

      {/* Floor marker */}
      <DeskMarker occupied color={markerColor} />
    </button>
  );
}

// Empty spot — shows an available desk with no agent
export function EmptyDeskSpot() {
  return (
    <div className="relative flex flex-col items-center opacity-30">
      <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
        <span className="text-white/40 text-xs">+</span>
      </div>
      <DeskMarker occupied={false} />
    </div>
  );
}
