import { GraduationCap } from "lucide-react";

export default function ProjectsLoading() {
  return (
    <div className="px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-emerald-400/60" />
              <div className="h-8 w-64 rounded bg-white/10" />
            </div>
            <div className="h-4 w-72 rounded bg-white/5" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-white/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((column) => (
            <div key={column} className="space-y-4">
              <div className="h-12 rounded-xl bg-white/8 border border-white/10" />
              {[0, 1].map((card) => (
                <div key={card} className="rounded-2xl border border-white/8 overflow-hidden bg-card">
                  <div className="h-32 bg-white/8" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 w-3/4 rounded bg-white/10" />
                    <div className="h-4 w-1/2 rounded bg-white/5" />
                    <div className="h-4 w-full rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}