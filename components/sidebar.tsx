"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GraduationCap, Users, MessageCircle, Settings2, Heart, Sparkles, Bot, X } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { useChatPanel } from "@/components/chat/ChatPanelProvider";

// ── Office nav overlay context ────────────────────────────────────────────────
interface OfficeNavContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}
const OfficeNavContext = createContext<OfficeNavContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function useOfficeNav() {
  return useContext(OfficeNavContext);
}

export function OfficeNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <OfficeNavContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false), toggle: () => setIsOpen((v) => !v) }}>
      {children}
    </OfficeNavContext.Provider>
  );
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
  { href: "/review-assets", label: "Review Assets", icon: Sparkles },
  { href: "/projects", label: "Cours", icon: GraduationCap },
  { href: "/proto", label: "Proto Lab", icon: Sparkles },
  { href: "/collaborateur", label: "Collaborateurs", icon: Users },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/eve", label: "Eve Workshop", icon: Bot },
];

// Mobile bottom nav
const mobileNavLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/review-assets", label: "Review", icon: Sparkles },
  { href: "/proto", label: "Proto", icon: Sparkles },
  { href: "/projects", label: "Cours", icon: GraduationCap },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/collaborateur", label: "Équipe", icon: Users },
  { href: "/eve", label: "Eve", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const isOffice = pathname === "/";
  const isChatRoute = pathname.startsWith("/chat");
  const officeNav = useOfficeNav();
  const { unreadCount, waitingAgents } = useChatPanel();

  // Compute intensity from waiting agents moods
  const intensity = (() => {
    if (!waitingAgents.length) return "low" as const;
    const order = { low: 0, medium: 1, high: 2 } as const;
    let best: "low" | "medium" | "high" = "low";
    for (const a of waitingAgents) {
      const i = (moodHints[a.mood ?? "neutre"] ?? moodHints.neutre).intensity;
      if (order[i] > order[best]) best = i;
    }
    return best;
  })();

  const hasNotif = unreadCount > 0 && !isChatRoute;

  // On the office page, sidebar is an overlay panel controlled by OfficeNavContext
  if (isOffice) {
    return (
      <>
        {/* Backdrop */}
        {officeNav.isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={officeNav.close}
          />
        )}
        {/* Slide-in panel */}
        <aside
          className={[
            "fixed left-0 top-0 h-full w-72 z-50 flex flex-col px-5 py-8",
            "bg-card/95 backdrop-blur-xl border-r border-white/10 shadow-[4px_0_60px_rgba(0,0,0,0.6)]",
            "transition-transform duration-300 ease-in-out",
            officeNav.isOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          {/* Close button */}
          <button
            onClick={officeNav.close}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-12 px-2 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/50 flex shrink-0 items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
              <span className="font-bold text-white text-base">E</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-primary transition-colors leading-tight">Eden</h1>
              <p className="text-xs uppercase tracking-widest font-semibold text-primary/70">Studio</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              const Icon = link.icon;
              const isChatWithNotif = link.href === "/chat" && hasNotif;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={officeNav.close}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-medium transition-all group relative overflow-hidden ${
                    isActive ? "text-primary bg-primary/12" : "text-muted-foreground hover:text-white hover:bg-white/6"
                  }`}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />}
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"} transition-colors relative z-10`} />
                  <span className="relative z-10 flex-1">{link.label}</span>
                  {isChatWithNotif && (
                    <div className="relative z-10 flex items-center gap-1.5">
                      {intensity === "high" ? (
                        <Heart className="w-3.5 h-3.5 text-rose-400 animate-heartbeat" />
                      ) : intensity === "medium" ? (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      ) : null}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-5.5 text-center shadow-lg animate-in zoom-in duration-300 ${
                        intensity === "high"
                          ? "bg-rose-500/20 text-rose-300 shadow-rose-500/20 border border-rose-500/30"
                          : intensity === "medium"
                          ? "bg-amber-500/20 text-amber-300 shadow-amber-500/20 border border-amber-500/30"
                          : "bg-primary text-primary-foreground shadow-primary/20"
                      }`}>
                        {unreadCount}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-5">
            <Link href="/settings" onClick={officeNav.close} className="flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all hover:bg-white/6 cursor-pointer text-muted-foreground hover:text-white">
              <div className="w-9 h-9 rounded-full bg-white/12 flex shrink-0 items-center justify-center overflow-hidden">
                <span className="text-sm font-bold text-white">RM</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-base font-medium text-white truncate">Romain</p>
                <p className="text-sm text-muted-foreground truncate">Producteur</p>
              </div>
              <Settings2 className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-72 border-r border-white/10 bg-card/80 backdrop-blur-xl h-screen sticky top-0 flex-col px-5 py-8 shadow-[1px_0_60px_rgba(0,0,0,0.4)] z-50">
        <div className="flex items-center gap-3 mb-12 px-2 group cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/50 flex shrink-0 items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
            <span className="font-bold text-white text-base">E</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white group-hover:text-primary transition-colors leading-tight">
              Eden
            </h1>
            <p className="text-xs uppercase tracking-widest font-semibold text-primary/70">Studio</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const Icon = link.icon;
            const isChatWithNotif = link.href === "/chat" && hasNotif;

            return (
              <div key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-medium transition-all group relative overflow-hidden ${
                    isActive
                      ? "text-primary bg-primary/12"
                      : "text-muted-foreground hover:text-white hover:bg-white/6"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"} transition-colors relative z-10`} />
                  <span className="relative z-10 flex-1">{link.label}</span>
                  {isChatWithNotif && (
                    <div className="relative z-10 flex items-center gap-1.5">
                      {intensity === "high" ? (
                        <Heart className="w-3.5 h-3.5 text-rose-400 animate-heartbeat" />
                      ) : intensity === "medium" ? (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      ) : null}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-5.5 text-center shadow-lg animate-in zoom-in duration-300 ${
                          intensity === "high"
                            ? "bg-rose-500/20 text-rose-300 shadow-rose-500/20 border border-rose-500/30"
                            : intensity === "medium"
                              ? "bg-amber-500/20 text-amber-300 shadow-amber-500/20 border border-amber-500/30"
                              : "bg-primary text-primary-foreground shadow-primary/20"
                        }`}
                      >
                        {unreadCount}
                      </span>
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <Link href="/settings" className="flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all hover:bg-white/6 cursor-pointer text-muted-foreground hover:text-white">
            <div className="w-9 h-9 rounded-full bg-white/12 flex shrink-0 items-center justify-center overflow-hidden">
               <span className="text-sm font-bold text-white">RM</span>
            </div>
            <div className="flex-1 overflow-hidden">
               <p className="text-base font-medium text-white truncate">Romain</p>
               <p className="text-sm text-muted-foreground truncate">Producteur</p>
            </div>
            <Settings2 className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity shrink-0" />
          </Link>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-background/90 backdrop-blur-xl safe-area-bottom">
        <div className="flex items-center justify-around px-2 h-16">
          {mobileNavLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const Icon = link.icon;
            const isChatWithNotif = link.href === "/chat" && hasNotif;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-white"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {isChatWithNotif && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center leading-none ${
                        intensity === "high"
                          ? "bg-rose-500 text-white"
                          : intensity === "medium"
                            ? "bg-amber-500 text-white"
                            : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {unreadCount}
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
