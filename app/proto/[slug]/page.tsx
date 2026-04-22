import { notFound } from "next/navigation";
import Link from "next/link";
import { ProtoDetail } from "@/components/proto/ProtoDetail";
import { getPrototypeBySlug } from "@/lib/data/prototypes";

interface ProtoDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProtoDetailPage({ params }: ProtoDetailPageProps) {
  const { slug } = await params;
  const proto = getPrototypeBySlug(slug);

  if (!proto) {
    notFound();
  }

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link
          href="/proto"
          className="inline-flex items-center text-sm text-muted-foreground transition hover:text-foreground"
        >
          Retour au catalogue
        </Link>

        <header className="mt-4 mb-8 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{proto.slug}</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">{proto.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{proto.previewDescription}</p>
        </header>

        <ProtoDetail proto={proto} />
      </div>
    </main>
  );
}
