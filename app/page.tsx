import Link from "next/link";
import { projects, statusLabels, getProjectStatus } from "@/lib/data/projects";
import { Plus, Users, Gamepad2, Activity, ArrowRight, LayoutDashboard, Sparkles, FolderKanban } from "lucide-react";

export default function Home() {
  const activeProjectsCount = projects.filter((p) => getProjectStatus(p) === "in-dev").length;
  const conceptProjectsCount = projects.filter((p) => getProjectStatus(p) === "concept").length;
  const releasedProjectsCount = projects.filter((p) => getProjectStatus(p) === "released").length;

  return (
    <div className="flex flex-col pt-4 md:pt-10 px-0 md:px-6 pb-24">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 md:mb-10 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3 mb-2">
              <LayoutDashboard className="w-7 h-7 md:w-8 md:h-8 text-primary" />
              Studio Dashboard
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Vue d'ensemble et pilotage rapide de vos activités.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/projects/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Nouveau projet
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-8 md:mb-12">
          <div className="p-4 md:p-6 rounded-2xl bg-card border border-white/8 flex items-center gap-3 md:gap-4 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">En développement</p>
              <p className="text-3xl font-bold text-foreground tracking-tight">{activeProjectsCount} <span className="text-xl text-muted-foreground font-normal">projet{activeProjectsCount > 1 ? "s" : ""}</span></p>
            </div>
          </div>
          
          <div className="p-4 md:p-6 rounded-2xl bg-card border border-white/8 flex items-center gap-3 md:gap-4 hover:border-yellow-500/30 hover:shadow-lg transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0 shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">En conception</p>
              <p className="text-3xl font-bold text-foreground tracking-tight">{conceptProjectsCount} <span className="text-xl text-muted-foreground font-normal">idée{conceptProjectsCount > 1 ? "s" : ""}</span></p>
            </div>
          </div>

          <div className="p-4 md:p-6 rounded-2xl bg-card border border-white/8 flex items-center gap-3 md:gap-4 hover:border-emerald-500/30 hover:shadow-lg transition-all duration-300">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 shadow-inner">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Jeux publiés</p>
              <p className="text-3xl font-bold text-foreground tracking-tight">{releasedProjectsCount} <span className="text-xl text-muted-foreground font-normal">titre{releasedProjectsCount > 1 ? "s" : ""}</span></p>
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Projects Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Projects List (Compact View) */}
          <div className="lg:col-span-2">
             <div className="flex items-center justify-between mb-5">
               <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-muted-foreground" />
                  Accès rapide
               </h2>
               <Link href="/projects" className="text-sm text-primary hover:underline font-medium">
                  Voir le board →
               </Link>
             </div>
             
             <div className="flex flex-col gap-3">
               {projects.slice(0, 5).map((project) => (
                  <Link 
                    href={`/projects/${project.id}`} 
                    key={project.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-card border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all duration-300 group shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      {/* Thumbnail Gradient */}
                      <div className={`w-12 h-12 rounded-lg bg-linear-to-br ${project.coverGradient} shadow-inner shrink-0 ring-1 ring-white/10`} />
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base">{project.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{project.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusBadgeClass(getProjectStatus(project))}`}>
                         {statusLabels[getProjectStatus(project)]}
                       </span>
                       <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                         <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                       </div>
                    </div>
                  </Link>
               ))}
             </div>
          </div>

          {/* Actions & Health Sidebar */}
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
                 ⚡ Actions Rapides
              </h2>
              <div className="flex flex-col gap-3">
                <Link href="/collaborateur" className="flex items-center gap-4 w-full p-4 rounded-xl bg-card border border-white/5 hover:bg-white/5 hover:border-primary/30 transition-all text-left shadow-sm group">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Collaborateurs</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Piloter l'équipe</p>
                  </div>
                </Link>
                
                <button className="flex items-center gap-4 w-full p-4 rounded-xl bg-card border border-white/5 hover:bg-white/5 hover:border-indigo-500/30 transition-all text-left shadow-sm group">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">Générer Asset</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Outil IA (Bientôt)</p>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Status Widget */}
            <div className="p-6 rounded-2xl bg-linear-to-br from-primary/10 to-indigo-500/5 border border-primary/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Activity className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-primary mb-2 text-lg">Santé du Studio</h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    Les serveurs sont opérationnels. L'équipe est prête à concevoir le prochain succès.
                  </p>
                  <div className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-2" />
                    Connecté au réseau
                  </div>
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "concept":
      return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    case "in-dev":
      return "bg-primary/15 text-primary border-primary/30";
    case "released":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
