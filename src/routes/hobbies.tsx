import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { Starfield } from "@/components/Starfield";
import { SectionHeader } from "@/components/SectionHeader";
import { HobbyCard } from "@/components/HobbyCard";
import { hobbies, type HobbyCategory, type HobbyStatus } from "@/data/hobbies";

export const Route = createFileRoute("/hobbies")({
  head: () => ({
    meta: [
      { title: "Hobbies — 0xiZO" },
      { name: "description", content: "Anime, games, and TV series I'm tracking." },
      { property: "og:title", content: "Hobbies — 0xiZO" },
      { property: "og:description", content: "Anime, games, and TV series I'm tracking." },
    ],
  }),
  component: HobbiesPage,
});

const categories: HobbyCategory[] = ["Anime", "Games", "TV Series"];
const statuses: ("All" | HobbyStatus)[] = ["All", "active", "archived", "planned"];

function HobbiesPage() {
  const [cat, setCat] = useState<HobbyCategory>("Anime");
  const [status, setStatus] = useState<(typeof statuses)[number]>("All");

  const filtered = useMemo(
    () =>
      hobbies.filter(
        (h) => h.category === cat && (status === "All" || h.status === status)
      ),
    [cat, status]
  );

  return (
    <div className="min-h-screen relative">
      <Starfield density={0.4} />
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 pt-28 pb-20">
        <SectionHeader
          kicker="TAKE A BREAK or BREAK TAKES YOU"
          title="Hobbies"
          subtitle=""
        />

        {/* Category tabs */}
        <div role="tablist" className="flex gap-1 p-1 glass rounded-xl w-fit">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={`relative mono text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-colors cursor-target ${
                cat === c ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === c && (
                <motion.span
                  layoutId="hobby-tab"
                  className="absolute inset-0 bg-primary rounded-lg"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{c}</span>
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex gap-2 mt-5 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors cursor-target ${
                status === s
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-accent/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Grid */}
        <motion.div
          layout
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((h, i) => (
              <HobbyCard key={h.id} h={h} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <p className="mono text-xs text-muted-foreground mt-10 text-center">
            // no transmissions matching that filter
          </p>
        )}
      </main>
    </div>
  );
}
