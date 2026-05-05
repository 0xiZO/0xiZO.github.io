import { motion } from "framer-motion";
import type { Hobby } from "@/data/hobbies";
import { ExternalLink, Star } from "lucide-react";

const statusStyles: Record<Hobby["status"], string> = {
  active: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
  archived: "border-sky-400/40 text-sky-300 bg-sky-400/10",
  planned: "border-amber-400/40 text-amber-300 bg-amber-400/10",
};

function isImageUrl(s: string) {
  return /^(https?:\/\/|\/|data:image)/.test(s.trim());
}

export function HobbyCard({ h, index = 0 }: { h: Hobby; index?: number }) {
  const useImg = isImageUrl(h.image);
  return (
    <motion.a
      href={h.source}
      target="_blank"
      rel="noreferrer noopener"
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -6 }}
      className="group glass rounded-xl overflow-hidden flex flex-col cursor-target hover:border-primary/60 transition-colors"
    >
      <div
        className="h-40 relative overflow-hidden bg-muted"
        style={useImg ? undefined : { backgroundImage: h.image }}
      >
        {useImg && (
          <img
            src={h.image}
            alt={h.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
        <div className="absolute top-3 left-3 mono text-[10px] uppercase tracking-widest text-foreground/90 px-2 py-1 rounded bg-black/40 backdrop-blur">
          {h.category}
        </div>
        <span
          className={`absolute top-3 right-3 mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${statusStyles[h.status]}`}
        >
          {h.status}
        </span>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
            {h.title}
          </h3>
          {h.rating > 0 && (
            <div className="flex items-center gap-1 mono text-xs text-amber-300 shrink-0">
              <Star className="size-3 fill-amber-300" />
              {h.rating.toFixed(1)}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 flex-1">
          {h.note}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest text-primary group-hover:text-accent transition-colors">
          Source <ExternalLink className="size-3" />
        </span>
      </div>
    </motion.a>
  );
}
