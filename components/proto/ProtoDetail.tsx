import type { ProtoMeta } from "@/lib/types/proto";

interface ProtoDetailProps {
  proto: ProtoMeta;
}

export function ProtoDetail({ proto }: ProtoDetailProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">Resume du jeu</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{proto.gameSummary}</p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">Apercu prototype</h2>
        {proto.playable ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-black/30">
            <iframe
              src={`/prototypes/${proto.slug}/index.html`}
              title={`Prototype ${proto.title}`}
              className="h-[420px] w-full"
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/30 p-6 text-sm text-muted-foreground">
            Le prototype jouable n&apos;est pas encore publie. Cette page expose deja la fiche de reutilisation
            pour le pipeline.
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
          <h3 className="text-base font-semibold text-foreground">What to reuse</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {proto.whatToReuse.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
          <h3 className="text-base font-semibold text-foreground">What to avoid</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {proto.whatToAvoid.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
        <h3 className="text-base font-semibold text-foreground">Mecaniques cibles</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {proto.mechanics.map((mechanic) => (
            <span
              key={mechanic}
              className="rounded-full border border-border/70 bg-muted/50 px-2 py-1 text-xs tracking-wide text-muted-foreground"
            >
              {mechanic}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
