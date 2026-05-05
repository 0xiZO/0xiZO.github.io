export function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-10">
      {kicker && (
        <div className="mono text-xs text-primary tracking-[0.3em]">// {kicker}</div>
      )}
      <h2 className="text-3xl md:text-5xl font-black mt-2 text-glow">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-muted-foreground max-w-2xl">{subtitle}</p>
      )}
    </div>
  );
}
