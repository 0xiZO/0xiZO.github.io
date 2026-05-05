import { useEffect, useRef, useState } from "react";

export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -100, y: -100 });
  const pos = useRef({ x: -100, y: -100 });
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        "ontouchstart" in window);
    if (isTouch) return;
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-on");

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = `${e.clientX}px`;
        dotRef.current.style.top = `${e.clientY}px`;
      }
      const t = e.target as HTMLElement | null;
      const interactive = !!t?.closest(
        'a, button, [role="button"], input, textarea, select, label, .cursor-target'
      );
      setHovering(interactive);
    };
    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);
    const onLeave = () => {
      target.current.x = -100;
      target.current.y = -100;
    };

    let raf = 0;
    const tick = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.18;
      pos.current.y += (target.current.y - pos.current.y) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.left = `${pos.current.x}px`;
        ringRef.current.style.top = `${pos.current.y}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("custom-cursor-on");
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className={`pointer-events-none fixed z-[9999] h-9 w-9 rounded-full border transition-[transform,background-color,border-color,opacity] duration-200 ease-out animate-cursor-pulse ${
          hovering
            ? "border-[oklch(0.7_0.2_310)] bg-[oklch(0.7_0.2_310/0.15)]"
            : "border-[oklch(0.85_0.15_200)] bg-[oklch(0.85_0.15_200/0.05)]"
        }`}
        style={{
          left: 0,
          top: 0,
          transform: `translate(-50%, -50%) scale(${clicking ? 0.8 : hovering ? 1.4 : 1})`,
          mixBlendMode: "screen",
        }}
      />
      <div
        ref={dotRef}
        aria-hidden
        className={`pointer-events-none fixed z-[9999] h-1.5 w-1.5 rounded-full transition-colors ${
          hovering ? "bg-[oklch(0.75_0.2_310)]" : "bg-[oklch(0.92_0.18_200)]"
        }`}
        style={{
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
          boxShadow: hovering
            ? "0 0 12px oklch(0.7 0.25 310), 0 0 24px oklch(0.7 0.25 310 / 0.6)"
            : "0 0 12px oklch(0.85 0.2 200), 0 0 24px oklch(0.85 0.2 200 / 0.6)",
        }}
      />
    </>
  );
}
