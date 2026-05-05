import { Link } from "@tanstack/react-router";
import type { Writeup } from "@/data/writeups";

const diffColor: Record<Writeup["difficulty"], string> = {
  easy: "text-emerald-400 border-emerald-400/40",
  medium: "text-amber-400 border-amber-400/40",
  hard: "text-rose-400 border-rose-400/40",
  insane: "text-fuchsia-400 border-fuchsia-400/40",
};

export function WriteupCard({ w }: { w: Writeup }) {
  return (
    <Link
      to="/writeups/$slug"
      params={{ slug: w.slug }}
      className="group glass rounded-xl p-5 block transition-all hover:border-primary/60 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mono">
        <span className="text-primary">{w.category}</span>
        <span>•</span>
        <span>{w.ctf}</span>
      </div>
      <h3 className="mt-2 text-lg font-bold text-foreground group-hover:text-primary transition-colors">
        {w.title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{w.summary}</p>
      <div className="mt-4 flex items-center justify-between text-xs mono">
        <span className={`px-2 py-0.5 border rounded ${diffColor[w.difficulty]}`}>
          {w.difficulty} · {w.points}pt
        </span>
        <span className="text-muted-foreground">{w.date}</span>
      </div>
    </Link>
  );
}