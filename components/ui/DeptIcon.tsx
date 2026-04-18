import {
  Palette,
  Code2,
  Gamepad2,
  Music,
  BookOpen,
  Bug,
  Megaphone,
  Kanban,
  type LucideProps,
} from "lucide-react";
import type { Department } from "@/lib/types/agent";

interface DeptConfig {
  Icon: React.FC<LucideProps>;
  color: string; // tailwind text color
  bg: string;    // tailwind bg color
}

const DEPT_CONFIG: Record<Department, DeptConfig> = {
  art:          { Icon: Palette,   color: "text-pink-400",    bg: "bg-pink-500/20" },
  programming:  { Icon: Code2,     color: "text-cyan-400",    bg: "bg-cyan-500/20" },
  "game-design":{ Icon: Gamepad2,  color: "text-amber-400",   bg: "bg-amber-500/20" },
  audio:        { Icon: Music,     color: "text-violet-400",  bg: "bg-violet-500/20" },
  narrative:    { Icon: BookOpen,  color: "text-emerald-400", bg: "bg-emerald-500/20" },
  qa:           { Icon: Bug,       color: "text-lime-400",    bg: "bg-lime-500/20" },
  marketing:    { Icon: Megaphone, color: "text-red-400",     bg: "bg-red-500/20" },
  production:   { Icon: Kanban,    color: "text-indigo-400",  bg: "bg-indigo-500/20" },
};

interface DeptIconProps {
  department: string;
  size?: number;
  showBg?: boolean;
  className?: string;
}

export function DeptIcon({ department, size = 16, showBg = false, className = "" }: DeptIconProps) {
  const config = DEPT_CONFIG[department as Department];
  if (!config) return null;

  const { Icon, color, bg } = config;

  if (showBg) {
    return (
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${bg} ${className}`}>
        <Icon size={size} className={color} />
      </span>
    );
  }

  return <Icon size={size} className={`${color} ${className}`} />;
}
