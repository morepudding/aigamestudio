"use client";

import Link from "next/link";
import { Users, UserPlus, Info, Trash2, Image as ImageIcon } from "lucide-react";
import { projects } from "@/lib/data/projects";
import { departments } from "@/lib/wizard-data";
import { useEffect, useState } from "react";
import { MoodRing, type Mood } from "@/components/ui/MoodRing";

interface Agent {
  slug: string;
  name: string;
  role: string;
  department: string;
  gender: string;
  personality_primary: string;
  personality_nuance: string;
  is_system_agent: boolean;
  mood?: string | null;
  icon_url?: string | null;
}

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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CollaborateurPage() {
  const activeProjectsCount = projects.filter((p) => p.status !== "released").length;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch(() => setAgents([]));
  }, []);

  const deleteAgent = async (slug: string, name: string) => {
    if (!confirm(`Virer ${name} du studio ? Cette action est irréversible.`)) return;
    setDeleting(slug);
    try {
      const res = await fetch("/api/agents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.slug !== slug));
      }
    } catch {
      // silent fail
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">Collaborateurs</h1>
          <p className="text-sm text-muted-foreground">
            Gérez l&apos;équipe de votre studio et attribuez les rôles.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/collaborateur/galerie"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Galerie photos
          </Link>
          <Link
            href="/collaborateur/recruter"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20"
          >
            <UserPlus className="w-4 h-4" />
            Recruter un agent IA
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Admin card */}
        <div className="group relative bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-colors overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-transparent opacity-50" />
          <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0 text-white font-bold text-lg">
              RM
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">Romain</h3>
              <p className="font-medium text-primary text-sm mb-1">Directeur de Studio</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                <span>Admin</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Département</span>
              <span className="font-medium text-white px-2 py-0.5 rounded-full bg-white/10 text-xs">Direction</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Projets actifs</span>
              <span className="font-medium text-white">{activeProjectsCount}</span>
            </div>
          </div>
        </div>

        {/* Agent cards */}
        {agents.map((agent) => {
          const dept = departments.find((d) => d.id === agent.department);
          const gradient = departmentGradients[agent.department] ?? "from-gray-500 to-gray-600";

          return (
            <div
              key={agent.slug}
              className="group relative bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-colors overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-transparent opacity-50" />

              {/* Delete button — hidden for system agents */}
              {!agent.is_system_agent && (
                <button
                  onClick={() => deleteAgent(agent.slug, agent.name)}
                  disabled={deleting === agent.slug}
                  className="absolute top-3 right-3 w-9 h-9 md:w-8 md:h-8 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center text-white/30 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  title={`Virer ${agent.name}`}
                >
                  <Trash2 className={`w-3.5 h-3.5 ${deleting === agent.slug ? "animate-spin" : ""}`} />
                </button>
              )}

              <Link href={`/collaborateur/${agent.slug}`} className="block">
                <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
                  <MoodRing
                    mood={agent.mood as Mood}
                    size="lg"
                    imageUrl={agent.icon_url}
                    fallbackGradient={gradient}
                    initials={getInitials(agent.name)}
                    showOnlineIndicator={true}
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">
                      {agent.name}
                    </h3>
                    <p className="font-medium text-primary text-sm mb-1">{agent.role}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="w-3 h-3" />
                      <span>Agent IA</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Département</span>
                    <span className="font-medium text-white px-2 py-0.5 rounded-full bg-white/10 text-xs">
                      {dept?.emoji} {dept?.label ?? agent.department}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Personnalité</span>
                    <span className="font-medium text-white px-2 py-0.5 rounded-full bg-white/10 text-xs">
                      {agent.personality_primary} / {agent.personality_nuance}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}

        {/* Recruit card */}
        <Link
          href="/collaborateur/recruter"
          className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-primary/50 transition-all cursor-pointer text-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white mb-1">Recruter</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ajoutez de nouveaux agents IA ou membres d&apos;équipe à votre studio.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
