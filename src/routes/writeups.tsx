import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { WriteupCard } from "@/components/WriteupCard";
import { writeups } from "@/data/writeups";

export const Route = createFileRoute("/writeups")({
  head: () => ({
    meta: [
      { title: "Writeups — 0xiZO" },
      { name: "description", content: "All pwn CTF writeups." },
    ],
  }),
  component: WriteupsLayout,
});

function WriteupsLayout() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId === "/writeups/$slug");
  if (isChild) return <Outlet />;
  return <WriteupsIndex />;
}

function WriteupsIndex() {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const cats = useMemo(
    () => ["all", ...Array.from(new Set(writeups.map((w) => w.difficulty)))],
    []
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return writeups.filter((w) => {
      if (filter !== "all" && w.difficulty !== filter) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.summary.toLowerCase().includes(q) ||
        w.ctf.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [filter, query]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 pt-28 pb-20">
        <div className="mono text-xs text-primary tracking-[0.3em]">// ARCHIVE</div>
        <h1 className="text-4xl md:text-5xl font-black mt-2">All writeups</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          {writeups.length} solved challenges, each one a small victory over a binary.
        </p>

        <div className="mt-8 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, CTF, tag…"
            className="w-full glass rounded-lg pl-10 pr-3 py-2.5 mono text-sm bg-transparent outline-none focus:border-primary/60 transition-colors cursor-target"
          />
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`mono text-xs uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${
                filter === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {filtered.map((w) => (
            <WriteupCard key={w.slug} w={w} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="mono text-xs text-muted-foreground mt-10 text-center">
            // no writeups matched your search
          </p>
        )}
      </main>
    </div>
  );
}