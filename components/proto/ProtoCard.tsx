import Link from "next/link";
import type { ProtoMeta } from "@/lib/types/proto";

interface ProtoCardProps {
  proto: ProtoMeta;
}

export function ProtoCard({ proto }: ProtoCardProps) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {proto.genre.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border/70 bg-muted/50 px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-foreground">{proto.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{proto.previewDescription}</p>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Playbook: {proto.playbookType}</span>
        <span>{proto.playable ? "Disponible" : "En preparation"}</span>
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          href={`/proto/${proto.slug}`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Voir la fiche
        </Link>
        <Link
          href={`/proto/${proto.slug}`}
          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          {proto.playable ? "Jouer" : "Apercu"}
        </Link>
      </div>
    </article>
  );
}
