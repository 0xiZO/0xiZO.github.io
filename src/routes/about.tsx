import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { Starfield } from "@/components/Starfield";
import { SectionHeader } from "@/components/SectionHeader";
import { Github, Twitter, Mail, Globe as GlobeIcon } from "lucide-react";
import { Break } from "three/src/nodes/utils/LoopNode.js";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — 0xiZO" },
      { name: "description", content: "Who I am, what I break, and how to reach me." },
      { property: "og:title", content: "About — 0xiZO" },
      { property: "og:description", content: "Who I am, what I break, and how to reach me." },
    ],
  }),
  component: AboutPage,
});

const skills = [
  { name: "Binary Exploitation", value: 33 },
  { name: "Reverse Engineering", value: 33 },
  { name: "Heap / glibc internals", value: 33 },
  { name: "Web / Crypto (side quests)", value: 33 },
  { name: "Python · C · Assembly", value: 33 },
];

const socials = [
  { icon: Github, label: "github.com/0xiZO", href: "https://github.com/0xiZO" },
  { icon: Twitter, label: "@0xiZO", href: "#" },
  { icon: Mail, label: "toadd", href: "mailto:broWaitToAdd" },
  { icon: GlobeIcon, label: "pwner@Raptx", href: "https://raptx.org/" },
];

function AboutPage() {
  return (
    <div className="min-h-screen relative">
      <Starfield density={0.5} />
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 pt-28 pb-20">
        <SectionHeader
          kicker="OPERATOR PROFILE"
          title="About "
        />

        <div className="grid lg:grid-cols-[320px_1fr] gap-10">
          {/* Left column */}
          <aside className="space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="glass rounded-2xl p-5"
            >
              <div className="aspect-[3/4.14] rounded-xl overflow-hidden relative bg-gradient-to-br from-primary/30 via-accent/20 to-background">
                <div className="absolute inset-0 grid place-items-center mono text-7xl font-black text-primary/80">
                <div className="absolute inset-0 grid place-items-center">
                  {/* The Image from URL */}
                <img 
                  src="/assets/a.jpeg" 
                  alt="0xiZO" 
                  className="z-10 h-full w-auto object-contain opacity-80" 
                />

                  
                  {/* The Grid Overlay */}
                  <div className="absolute inset-0 bg-grid opacity-30" />
                </div>
                </div>
                <div className="absolute inset-0 bg-grid opacity-30" />
              </div>
              <h3 className="mt-5 text-xl font-black">0xiZO</h3>
              <p className="mono text-xs text-primary tracking-widest mt-1">
                CTF · PWN · LOW-LEVEL 
              </p>
              <dl className="mt-5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground mono uppercase tracking-widest">Loc</dt>
                  <dd>All to Grave</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground mono uppercase tracking-widest">Stack</dt>
                  <dd>Assembly · C · Python </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground mono uppercase tracking-widest">Coffee</dt>
                  <dd>3.14 cups/day</dd>
                </div>
              </dl>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {socials.map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="cursor-target flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Icon className="size-3.5" />
                    <span className="truncate">{label}</span>
                  </a>
                ))}
              </div>
            </motion.div>
          </aside>

          {/* Right column */}
          <section className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="text-2xl font-black text-glow">Bio</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90"> 
                <p>
                  I'm cybersecurity enthusiast, specializing in exploit development. — "My mom says I should pray at time 5 times a day, but I just pary when I solve a challenge, so..."   
                </p>
                <p>
                  I write things up so future-me (and you)
                  can skip the dead ends.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="text-2xl font-black text-glow">Skills</h2>
              <div className="mt-5 space-y-4">
                {skills.map((s, i) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mono">
                      <span>{s.name}</span>
                      <span className="text-primary">{s.value}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${s.value}%` }}
                        transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="glass rounded-2xl p-6"
              >
                <div className="mono text-[10px] uppercase tracking-widest text-primary">// Stat</div>
                <div className="text-4xl font-black mt-1 text-glow">0</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Challenges solved across 0 CTFs
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="glass rounded-2xl p-6"
              >
                <div className="mono text-[10px] uppercase tracking-widest text-accent">// Stat</div>
                <div className="text-4xl font-black mt-1 text-glow">0yrs</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Time spent making `gdb` cry
                </div>
              </motion.div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
