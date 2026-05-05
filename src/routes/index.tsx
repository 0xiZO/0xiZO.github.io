import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Globe } from "@/components/Globe";
import { SiteHeader } from "@/components/SiteHeader";
import { WriteupCard } from "@/components/WriteupCard";
import { Starfield } from "@/components/Starfield";
import { SectionHeader } from "@/components/SectionHeader";
import { writeups, type Writeup } from "@/data/writeups";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
          { title: "0xiZO — CTF Writeups from Around the Globe" },
      { name: "description", content: "Pwn & binary exploitation CTF writeups, plotted on a 3D Earth." },
      { property: "og:title", content: "ORBIT/PWN — CTF Writeups" },
      { property: "og:description", content: "Pwn & binary exploitation CTF writeups, plotted on a 3D Earth." },
    ],
  }),
  component: Index,
});

function Index() {
  const [hovered, setHovered] = useState<Writeup | null>(null);

  return (
    <div className="min-h-screen relative">
      <Starfield density={0.6} />
      <SiteHeader />

      {/* Cinematic hero */}
      <section className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute inset-0">
          <Globe onPick={setHovered} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-24 left-6 md:left-12 max-w-xl pointer-events-none"
        >
          <div className="mono text-xs text-primary tracking-[0.3em] mb-3">
            // EYES ON EXPLOITS
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] text-foreground text-glow">
            CTF writeups,<br />
          <span className="text-primary">plotted by 0xiZO.</span>
          </h1>
          <p className="mt-5 text-sm md:text-base text-muted-foreground max-w-md">
            A constellation of pwn challenges I've solved — every pin is a pain I mean gain and it marks a writeup.
          </p>
          <div className="mt-7 pointer-events-auto flex gap-3 flex-wrap">
            <Link
              to="/writeups"
              className="cursor-target group inline-flex items-center gap-2 mono text-xs uppercase tracking-widest px-5 py-3 bg-primary text-primary-foreground rounded-md hover:shadow-[0_0_30px_oklch(0.78_0.18_50/0.6)] transition-shadow"
            >
              Browse writeups
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/about"
              className="cursor-target inline-flex items-center gap-2 mono text-xs uppercase tracking-widest px-5 py-3 border border-border rounded-md hover:border-primary/60 hover:text-primary transition-colors"
            >
              Operator profile
            </Link>
          </div>
        </motion.div>

        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-8 right-6 md:right-10 max-w-sm glass rounded-xl p-5"
          >
            <div className="mono text-[10px] uppercase tracking-widest text-primary">
              Beacon // {hovered.lat.toFixed(2)}, {hovered.lng.toFixed(2)}
            </div>
            <h3 className="mt-1 text-lg font-bold">{hovered.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {hovered.ctf} · {hovered.category}
            </p>
            <p className="text-sm mt-3">{hovered.summary}</p>
            <Link
              to="/writeups/$slug"
              params={{ slug: hovered.slug }}
              className="cursor-target mt-4 inline-block mono text-xs text-primary uppercase tracking-widest hover:underline"
            >
              Open writeup →
            </Link>
          </motion.div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 mono text-[10px] tracking-widest text-muted-foreground/60">
          DRAG · ZOOM · CLICK BEACONS
        </div>
      </section>

      {/* Recent writeups */}
      <section className="relative py-24 px-6 max-w-7xl mx-auto">
        <SectionHeader
          kicker="LATEST TRANSMISSIONS"
          title="Recent writeups"
          subtitle="Fresh logs from the latest events."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {writeups.slice(0, 6).map((w) => (
            <WriteupCard key={w.slug} w={w} />
          ))}
        </div>
        <div className="mt-10">
          <Link
            to="/writeups"
            className="cursor-target mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            View all writeups →
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-6 mono text-xs text-muted-foreground tracking-widest shadow-none text-center">
        © {new Date().getFullYear()} 0xiZO · Inspired by NASA Eyes
      </footer>
    </div>
  );
}
