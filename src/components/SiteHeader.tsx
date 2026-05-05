import { Link } from "@tanstack/react-router";

const linkBase =
  "text-muted-foreground hover:text-primary transition-colors";

export function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_0_20px_oklch(0.85_0.2_200/0.6)]" />
          <span className="mono text-sm tracking-[0.2em] text-foreground uppercase">
            0xiZO
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-xs mono uppercase tracking-widest">
          <Link to="/" className={linkBase} activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>Home</Link>
          <Link to="/writeups" className={linkBase} activeProps={{ className: "text-primary" }}>Writeups</Link>
          <Link to="/hobbies" className={linkBase} activeProps={{ className: "text-primary" }}>Hobbies</Link>
          <Link to="/about" className={linkBase} activeProps={{ className: "text-primary" }}>About</Link>
        </nav>
      </div>
    </header>
  );
}
