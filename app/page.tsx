import { PixelArtOffice } from "@/components/office/PixelArtOffice";
import { Layers } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen w-full px-0 md:px-6 py-4 md:py-8">
      <section className="mx-auto w-full max-w-7xl space-y-5">
        <header className="px-1 md:px-0 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                Bureau Isométrique
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-12">
              Éditeur visuel — ajoutez, placez et personnalisez les éléments de votre studio.
            </p>
          </div>
        </header>

        <PixelArtOffice />
      </section>
    </main>
  );
}
