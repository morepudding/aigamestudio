"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderGit2, Users, MessageCircle, Settings2, Heart, Sparkles, Bot } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface EmotionalNotification {
  count: number;
  hint: string | null;
  mood: string | null;
  agentName: string | null;
  intensity: "low" | "medium" | "high";
}

const moodHints: Record<string, { hint: string; intensity: "low" | "medium" | "high" }> = {
  enthousiaste: { hint: "déborde d'énergie", intensity: "high" },
  frustré: { hint: "semble contrariée", intensity: "high" },
  curieux: { hint: "a une question", intensity: "medium" },
  fier: { hint: "veut partager quelque chose", intensity: "medium" },
  inquiet: { hint: "a besoin de vous", intensity: "high" },
  joueur: { hint: "veut s'amuser", intensity: "medium" },
  nostalgique: { hint: "pense à vous", intensity: "low" },
  inspiré: { hint: "a une idée", intensity: "high" },
  agacé: { hint: "attend votre réponse", intensity: "medium" },
  neutre: { hint: "vous a écrit", intensity: "low" },
};

const navLinks = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/projects", label: "Projets", icon: FolderGit2 },
  { href: "/collaborateur", label: "Collaborateurs", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/pilotage", label: "Contexte", icon: Settings2 },
  { href: "/eve", label: "Eve Workshop", icon: Bot },
];

// Mobile bottom nav: prioritize relational, de-prioritize projects
const mobileNavLinks = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/collaborateur", label: "Équipe", icon: Users },
  { href: "/eve", label: "Eve", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const [notification, setNotification] = useState<EmotionalNotification>({
    count: 0,
    hint: null,
    mood: null,
    agentName: null,
    intensity: "low",
  });

  const fetchEmotionalNotification = useCallback(async () => {
    try {
      // Get conversations where agent sent last message (awaiting user reply = false means agent just sent)
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("agent_slug")
        .eq("awaiting_user_reply", false);

      if (convErr || !convs || convs.length === 0) {
        setNotification({ count: 0, hint: null, mood: null, agentName: null, intensity: "low" });
        return;
      }

      const slugs = convs.map((c) => c.agent_slug);

      // Get agents with their moods
      const { data: agents, error: agentErr } = await supabase
        .from("agents")
        .select("slug, name, mood")
        .in("slug", slugs);

      if (agentErr || !agents || agents.length === 0) {
        setNotification({ count: convs.length, hint: null, mood: null, agentName: null, intensity: "low" });
        return;
      }

      // Pick the most "intense" mood for the hint
      let bestAgent = agents[0];
      let bestIntensity: "low" | "medium" | "high" = "low";

      for (const agent of agents) {
        const moodInfo = moodHints[agent.mood ?? "neutre"] ?? moodHints.neutre;
        const intensityOrder = { low: 0, medium: 1, high: 2 };
        if (intensityOrder[moodInfo.intensity] > intensityOrder[bestIntensity]) {
          bestAgent = agent;
          bestIntensity = moodInfo.intensity;
        }
      }

      const moodInfo = moodHints[bestAgent.mood ?? "neutre"] ?? moodHints.neutre;

      setNotification({
        count: convs.length,
        hint: moodInfo.hint,
        mood: bestAgent.mood,
        agentName: bestAgent.name,
        intensity: moodInfo.intensity,
      });
    } catch {
      setNotification({ count: 0, hint: null, mood: null, agentName: null, intensity: "low" });
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchEmotionalNotification();

    // Polling every 3 seconds
    const interval = setInterval(fetchEmotionalNotification, 3000);

    return () => clearInterval(interval);
  }, [fetchEmotionalNotification]);

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-64 border-r border-white/10 bg-background/50 backdrop-blur-xl h-screen sticky top-0 flex-col px-4 py-6 shadow-[1px_0_40px_rgba(0,0,0,0.5)] z-50">
        <div className="flex items-center gap-3 mb-10 px-2 group cursor-pointer">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex flex-shrink-0 items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <span className="font-bold text-background text-sm">E</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white group-hover:text-primary transition-colors leading-tight">
              Eden
            </h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-primary/80">Studio</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const Icon = link.icon;
            const isChatWithNotif = link.href === "/chat" && notification.count > 0;

            return (
              <div key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative overflow-hidden ${
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                  )}
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"} transition-colors relative z-10`} />
                  <span className="relative z-10 flex-1">{link.label}</span>
                  {isChatWithNotif && (
                    <div className="relative z-10 flex items-center gap-1.5">
                      {notification.intensity === "high" ? (
                        <Heart className="w-3 h-3 text-rose-400 animate-heartbeat" />
                      ) : notification.intensity === "medium" ? (
                        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                      ) : null}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg animate-in zoom-in duration-300 ${
                          notification.intensity === "high"
                            ? "bg-rose-500/20 text-rose-300 shadow-rose-500/20 border border-rose-500/30"
                            : notification.intensity === "medium"
                              ? "bg-amber-500/20 text-amber-300 shadow-amber-500/20 border border-amber-500/30"
                              : "bg-primary text-primary-foreground shadow-primary/20"
                        }`}
                      >
                        {notification.count}
                      </span>
                    </div>
                  )}
                </Link>

                {/* Emotional hint - Dating sim style */}
                {isChatWithNotif && notification.agentName && notification.hint && (
                  <div className="ml-10 mt-1 mb-2 animate-in slide-in-from-left-2 fade-in duration-500">
                    <p
                      className={`text-[11px] italic leading-tight ${
                        notification.intensity === "high"
                          ? "text-rose-400/80"
                          : notification.intensity === "medium"
                            ? "text-amber-400/80"
                            : "text-muted-foreground/70"
                      }`}
                    >
                      {notification.agentName} {notification.hint}...
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5 cursor-pointer text-muted-foreground hover:text-white">
            <div className="w-8 h-8 rounded-full bg-white/10 flex flex-shrink-0 items-center justify-center overflow-hidden">
               <span className="text-xs font-bold text-white">RM</span>
            </div>
            <div className="flex-1 overflow-hidden">
               <p className="text-sm font-medium text-white truncate">Romain</p>
               <p className="text-xs text-muted-foreground truncate">Admin</p>
            </div>
            <Settings2 className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-background/90 backdrop-blur-xl safe-area-bottom">
        <div className="flex items-center justify-around px-2 h-16">
          {mobileNavLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const Icon = link.icon;
            const isChatWithNotif = link.href === "/chat" && notification.count > 0;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 min-w-[56px] py-2 rounded-xl transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-white"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {isChatWithNotif && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none ${
                        notification.intensity === "high"
                          ? "bg-rose-500 text-white"
                          : notification.intensity === "medium"
                            ? "bg-amber-500 text-white"
                            : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {notification.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
