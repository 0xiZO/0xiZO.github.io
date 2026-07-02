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
  { id: "a1", category: "Anime", title: "Cyberpunk: Edgerunners", image: "https://assetsio.gnwcdn.com/cyberpunk-edgerunners-mission-kit-box-art-header.png?width=1200&height=900&fit=crop&quality=100&format=png&enable=upscale&auto=webp", rating: 9.2, status: "active", source: "https://www.netflix.com/title/81054853", note: "Ten neon-soaked episodes that hit harder than any pwn payload." },
  { id: "a2", category: "Anime", title: "Steins;Gate", image:"https://simulationdaily.com/wp-content/uploads/ba6dec08-steins-gate-re-boot-crop.jpg", rating: 9.6, status: "archived", source: "https://myanimelist.net/anime/9253/", note: "Time travel done right. The fridge logic is clean as a ROP chain." },
  { id: "a3", category: "Anime", title: "Frieren", image: "https://blubbyweb.com/wp-content/uploads/2024/02/10000543394622246869468213112.jpg?w=1200", rating: 9.1, status: "active", source: "https://anilist.co/anime/154587/", note: "Slow, melancholy, beautiful. Perfect post-CTF wind-down." },
  {id: "a4", category: "Anime", title: "Dr. Stone", image: "https://occ-0-8407-2219.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABVL5bh_JFWRYdtX4xSYalXCnsyYQFPhfLR-L9QzZjkcUUToqt6Rgf-_2pAAYHln0a8eInZqFRfLTTamrqpIyrBeGgJJyy1YQyk8a.jpg?r=d39", rating: 8.1, status: "archived", source: "https://www.netflix.com/title/80244399", note: "Science is the ultimate exploit. Senku is the OG white-hat hacker." },
  {id: "a5", category: "Anime", title: "Tokyo Ghoul", image: "https://static0.srcdn.com/wordpress/wp-content/uploads/wm/2024/04/collage-style-image-featuring-the-cover-artwork-from-the-first-and-last-volumes-of-the-tokyo-ghoul-manga-as-well-as-official-art-of-kaneki-ken-from-the-anime-adaptation.jpg?w=1200&h=628&fit=crop", rating: 7.8, status: "archived", source: "https://myanimelist.net/anime/22319/", note: "Dark, violent, with a surprisingly good cafeteria food scene." },
  {id:"a6", category: "Anime", title: "Black Clover", image: "https://comicbook.com/wp-content/uploads/sites/4/2025/01/Black-Clover-Anime-Manga-Ending.jpg", rating: 7.5, status: "archived", source: "https://www.crunchyroll.com/series/GRE50KV36/black-clover?srsltid=AfmBOoqb3W4GYxlocUfjG7ggA0tDUSRLBxRfW0-ToWprFYyCIRsF3tuR", note: "Shonen tropes executed well. A solid 3-star anime." },
  {id:"a7", category: "Anime", title: "Hunter x Hunter ", image: "https://occ-0-8407-90.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABfz18GvKRJkoB0NpQb63OX3lLN-_y1RFo-y1mLSLctXnRrpdmNB0ZGB6x5ZwHNqu0BgnsFWylOCU7S2kikgMv_eWMHvoXVSbuz2Dmt6cog.jpg?r=327", rating: 9.3, status: "archived", source: "https://myanimelist.net/anime/136/Hunter_x_Hunter", note: "The Chimera Ant arc is a masterpiece of storytelling and character development." },
  {id:"a8" , category: "Anime", title: "Wind Breaker", image: "https://a.storyblok.com/f/178900/960x540/a8506a1255/wind-breaker.jpg/m/filters:quality(95)format(webp)", rating: 7.9, status: "archived", source: "https://myanimelist.net/anime/54900/Wind_Breaker", note: "Stylish and fun, but the plot is as thin as a single-layer ROP chain." },
  {id:"a9", category:"Anime", title: "Tokyo Ghoul √A", image: "https://image.tmdb.org/t/p/original/ArEQDtg825pzk5eMPo9HZY4zlqy.jpg", rating: 6.5, status: "archived", source: "https://myanimelist.net/anime/27899/Tokyo_Ghoul_%E2%88%9AA", note: "I feel bad for the characters in this one." },
  {id:"a10", category:"Anime", title: "LINK CLICK (Shiguang Dailiren)", image: "https://4kwallpapers.com/images/wallpapers/shiguang-dailiren-2880x1800-16190.jpg", rating: 6.9, status: "archived", source: "https://myanimelist.net/anime/44074/Shiguang_Dailiren", note: "I was bored and clicked a link." },
  {id:"a11",category:"Anime",title: "Lord of Mysteries",image:"https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=1920/keyart/GEXH3W2EZ-backdrop_wide",rating:9.6,status:"archived",source: "https://www.imdb.com/title/tt28618556/",note:"This is not a normal anime anymore."},
  {id:"a12",category:"Anime",title: "Bleach",image:"https://static0.srcdn.com/wordpress/wp-content/uploads/2026/01/bleach-s-ichigo-and-aizen.jpg?w=1600&h=900&fit=crop",rating:9.1,status:"active",note:"Soul Society is calling on F-Society."},

  { id: "g1", category: "Games", title: "Hades II", image: "https://static0.thegamerimages.com/wordpress/wp-content/uploads/wm/2024/06/29-playing-hades-2-in-early-access-has-made-me-actually-want-to-get-good.jpg", rating: 9.0, status: "active", source: "https://store.steampowered.com/app/1145350/", note: "Roguelike crack. The loop is the exploit." },
  { id: "g2", category: "Games", title: "Outer Wilds", image:"https://miro.medium.com/v2/resize:fit:1400/1*5oxAyo-zUTxauCiL9haobg.jpeg", rating: 9.8, status: "archived", source: "https://store.steampowered.com/app/753640/", note: "The single best 'aha' moment in any medium. Avoid spoilers like 0-days." },
  { id: "g3", category: "Games", title: "Silksong", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmTzsXZHkxJUL4bAcT3EpSfvDum619CXBRow&s", rating: 0, status: "planned", source: "https://store.steampowered.com/app/1030300/", note: "When? Soon™. I'm patient. (I'm not.)" },
  {id: "g4", category: "Games", title: "Elden Ring", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/page_bg_raw.jpg?t=1767883716", rating: 9.5, status: "archived", source: "https://store.steampowered.com/app/1245620/", note: "Open-world Dark Souls. A masterclass in game design and world-building." },
  {id: "g5", category: "Games",title: "Minecraft", image: "https://cms-assets.xboxservices.com/assets/65/15/6515e0be-8482-48bb-97f9-737010626408.jpg?n=Minecraft_Sneaky-Slider-1084_Tiny-Takeover_1600x675.jpg%202", rating: 8.5, status: "active", source: "https://www.minecraft.net/", note: "yo yo yooo, technoblade never dies o_O" },
  {id: "g6", category: "Games", title: "Forza Horizon 5", image: "https://image.api.playstation.com/vulcan/ap/rnd/202501/2717/0c5df2b67b23263d055f3b78aeb77a6ce4668bb078fced77.jpg", rating: 9.2, status: "active", source: "https://store.steampowered.com/app/1551360/", note: "whoa, I crash my streering wheel more than I do my actual car now" },

  { id: "t1", category: "TV Series", title: "Mr. Robot", image: "https://images.squarespace-cdn.com/content/v1/51b3dc8ee4b051b96ceb10de/1563389588029-6EXPSGO675FPLF9784AG/image-asset.jpegs", rating: 9.5, status: "archived", source: "https://www.imdb.com/title/tt4158110/", note: "The only show that gets `nmap` syntactically correct." },
  { id: "t2", category: "TV Series", title: "Severance", image: "https://platform.vox.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/23377229/ATV_Severance_Photo_010804.jpg?quality=90&strip=all&crop=0,3.497276182088,100,93.033876465887", rating: 9.3, status: "active", source: "https://tv.apple.com/us/show/severance/", note: "Cold, surgical, deeply unsettling. Praise Kier." },
  { id: "t3", category: "TV Series", title: "Project Hail Mary", image: "https://www.hollywoodreporter.com/wp-content/uploads/2025/06/Project-Hail-Mary-trailer.jpg?w=1296&h=728&fit=crop", rating: 7.8, status: "archived", source: "https://www.imdb.com/title/tt10954600/", note: "bro wait i just moved this from movies.ts, should it be here? it's sci-fi but also a movie? hmm" },
  {id: "t4", category: "TV Series", title: "The Martian" , image: "https://occ-0-8407-116.1.nflxso.net/dnm/api/v6/6AYY37jfdO6hpXcMjf9Yu5cnmO0/AAAABeHo_PFLCAMLDcG9kS-L456P8wdnvwFkMAma_XHr9w9wDFy1y2nhwMlK21Fc4Q9tYVP03Q0NnM6aWqiqeyCoOH_SVWgO7KcKaStz.jpg?r=8cf", rating: 8.0, status: "planned", source: "https://www.imdb.com/title/tt3659388/", note: "also a movie, but hey it's about Mars and survival so it fits the vibe" },

];
