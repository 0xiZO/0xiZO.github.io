export type HobbyStatus = "active" | "archived" | "planned";
export type HobbyCategory = "Anime" | "Games" | "TV Series";

export type Hobby = {
  id: string;
  category: HobbyCategory;
  title: string;
  /** Either an image URL (http(s):// or /path) or a CSS background value (e.g. linear-gradient(...)) */
  image: string;
  rating: number; // 0..10
  status: HobbyStatus;
  source: string;
  note: string;
};

// Simple gradient placeholder images (no external requests)
const grad = (a: string, b: string) =>
  `linear-gradient(135deg, ${a}, ${b})`;

export const hobbies: Hobby[] = [
  { id: "a1", category: "Anime", title: "Cyberpunk: Edgerunners", image: grad("#0ff", "#f0f"), rating: 9.2, status: "active", source: "https://www.netflix.com/title/81054853", note: "Ten neon-soaked episodes that hit harder than any pwn payload." },
  { id: "a2", category: "Anime", title: "Steins;Gate", image: grad("#fa0", "#f06"), rating: 9.6, status: "archived", source: "https://myanimelist.net/anime/9253/", note: "Time travel done right. The fridge logic is clean as a ROP chain." },
  { id: "a3", category: "Anime", title: "Frieren", image: grad("#6cf", "#a0f"), rating: 9.1, status: "active", source: "https://anilist.co/anime/154587/", note: "Slow, melancholy, beautiful. Perfect post-CTF wind-down." },
  { id: "g1", category: "Games", title: "Hades II", image: grad("#f33", "#90f"), rating: 9.0, status: "active", source: "https://store.steampowered.com/app/1145350/", note: "Roguelike crack. The loop is the exploit." },
  { id: "g2", category: "Games", title: "Outer Wilds", image: grad("#fc6", "#36f"), rating: 9.8, status: "archived", source: "https://store.steampowered.com/app/753640/", note: "The single best 'aha' moment in any medium. Avoid spoilers like 0-days." },
  { id: "g3", category: "Games", title: "Silksong", image: grad("#0fa", "#055"), rating: 0, status: "planned", source: "https://store.steampowered.com/app/1030300/", note: "When? Soon™. I'm patient. (I'm not.)" },
  { id: "t1", category: "TV Series", title: "Mr. Robot", image: grad("#0f9", "#003"), rating: 9.5, status: "archived", source: "https://www.imdb.com/title/tt4158110/", note: "The only show that gets `nmap` syntactically correct." },
  { id: "t2", category: "TV Series", title: "Severance", image: grad("#9cf", "#036"), rating: 9.3, status: "active", source: "https://tv.apple.com/us/show/severance/", note: "Cold, surgical, deeply unsettling. Praise Kier." },
  { id: "t3", category: "TV Series", title: "Pluribus", image: grad("#f60", "#406"), rating: 0, status: "planned", source: "https://tv.apple.com/", note: "Vince Gilligan's next thing. Already on the watchlist." },
];
