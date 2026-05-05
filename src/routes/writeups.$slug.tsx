import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { SiteHeader } from "@/components/SiteHeader";
import { getWriteup, writeups } from "@/data/writeups";

export const Route = createFileRoute("/writeups/$slug")({
  loader: ({ params }) => {
    const w = getWriteup(params.slug);
    if (!w) throw notFound();
    return w;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — 0xiZO` },
          { name: "description", content: loaderData.summary },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.summary },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-black">Lost in space</h1>
        <p className="text-muted-foreground mt-2">No writeup with that slug.</p>
        <Link to="/writeups" className="mono text-xs text-primary uppercase tracking-widest mt-6 inline-block">← back to archive</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
  component: WriteupPage,
});

function WriteupPage() {
  const w = Route.useLoaderData();
  const idx = writeups.findIndex((x) => x.slug === w.slug);
  const next = writeups[(idx + 1) % writeups.length];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <Link to="/writeups" className="mono text-xs text-muted-foreground uppercase tracking-widest hover:text-primary">
          ← Archive
        </Link>

        <div className="mt-6 flex items-center gap-2 mono text-xs uppercase tracking-widest text-primary">
          <span>{w.category}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{w.ctf}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{w.points} pts</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black mt-3 text-glow">{w.title}</h1>
        <p className="text-muted-foreground mt-3">{w.summary}</p>

        <div className="flex gap-2 mt-5 flex-wrap">
          {w.tags.map((t: string) => (
            <span key={t} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-border text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>

        <hr className="my-10 border-border" />

        <div className="prose-writeup">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {w.body}
          </ReactMarkdown>
        </div>

        <hr className="my-12 border-border" />

        <Link
          to="/writeups/$slug"
          params={{ slug: next.slug }}
          className="block glass rounded-xl p-5 hover:border-primary/60 transition-colors"
        >
          <div className="mono text-[10px] uppercase tracking-widest text-primary">Next transmission →</div>
          <div className="text-lg font-bold mt-1">{next.title}</div>
        </Link>
      </article>
    </div>
  );
}