import { MessageCircle } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="h-full overflow-y-auto scrollbar-none animate-pulse">
      <div className="mb-5 md:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary/60" />
          </div>
          <div className="space-y-2">
            <div className="h-7 w-40 rounded bg-white/10" />
            <div className="h-4 w-52 rounded bg-white/5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div key={card} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="h-1.5 bg-white/10" />
            <div className="p-4 md:p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="h-3 w-1/2 rounded bg-white/5" />
                  <div className="h-5 w-20 rounded-full bg-white/5" />
                </div>
              </div>
              <div className="h-14 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}