import { ProtoCard } from "@/components/proto/ProtoCard";
import { getAllPrototypes } from "@/lib/data/prototypes";

export const metadata = {
  title: "Prototypes | Eden Studio",
};

export default function ProtoCatalogPage() {
  const prototypes = getAllPrototypes();

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Proto Lab</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Catalogue des prototypes</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Cette phase expose les fiches de references pour la planification CrewAI. Les versions jouables
            seront ajoutees ensuite.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {prototypes.map((proto) => (
            <ProtoCard key={proto.slug} proto={proto} />
          ))}
        </section>
      </div>
    </main>
  );
}
