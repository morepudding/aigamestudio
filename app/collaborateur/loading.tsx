import { Users } from "lucide-react";

export default function CollaborateurLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-10 w-56 rounded bg-white/10" />
          <div className="h-5 w-80 rounded bg-white/5" />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="h-12 flex-1 sm:w-40 rounded-xl bg-white/10" />
          <div className="h-12 flex-1 sm:w-48 rounded-xl bg-white/10" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div key={card} className="rounded-2xl border border-white/12 p-5 md:p-7 bg-card space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/5" />
                <div className="h-4 w-20 rounded bg-white/5" />
              </div>
            </div>
            <div className="pt-4 border-t border-white/8 space-y-3">
              <div className="h-4 w-full rounded bg-white/5" />
              <div className="h-4 w-full rounded bg-white/5" />
            </div>
          </div>
        ))}
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-white/20 bg-white/5 gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-2 text-center w-full">
            <div className="h-5 w-24 rounded bg-white/10 mx-auto" />
            <div className="h-4 w-48 rounded bg-white/5 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}