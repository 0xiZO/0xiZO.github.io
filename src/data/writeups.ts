import matter from "gray-matter";
import { Buffer } from "buffer";

if (typeof globalThis !== "undefined" && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

export type Writeup = {
  slug: string;
  title: string;
  ctf: string;
  category: string;
  difficulty: "easy" | "medium" | "hard" | "insane";
  points: number;
  date: string;
  lat: number;
  lng: number;
  summary: string;
  tags: string[];
  body: string;
};

const files = import.meta.glob("/_posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function slugFromPath(path: string) {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  return name.replace(/^\d+[-_]?/, "");
}

export const writeups: Writeup[] = Object.entries(files)
  .map(([path, raw]) => {
    const { data, content } = matter(raw);
    return {
      slug: slugFromPath(path),
      title: data.title ?? "Untitled",
      ctf: data.ctf ?? "",
      category: data.category ?? "pwn",
      difficulty: (data.difficulty ?? "easy") as Writeup["difficulty"],
      points: data.points ?? 0,
      date: data.date ?? "",
      lat: data.lat ?? 0,
      lng: data.lng ?? 0,
      summary: data.summary ?? "",
      tags: data.tags ?? [],
      body: content,
    } as Writeup;
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1));

export const getWriteup = (slug: string) => writeups.find((w) => w.slug === slug);
