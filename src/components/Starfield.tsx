import { useEffect, useRef } from "react";

export function Starfield({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let stars: { x: number; y: number; z: number; r: number }[] = [];
    let w = 0, h = 0, cx = 0, cy = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = window.innerWidth * dpr;
      h = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      cx = w / 2; cy = h / 2;
      const count = Math.floor(((w * h) / 9000) * density);
      stars = Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * w,
        y: (Math.random() - 0.5) * h,
        z: Math.random() * w,
        r: Math.random() * 1.4 + 0.2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.fillStyle = "rgba(5, 8, 20, 0.35)";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        s.z -= 1.2;
        if (s.z <= 0) s.z = w;
        const k = 128 / s.z;
        const sx = s.x * k + cx;
        const sy = s.y * k + cy;
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        const size = s.r * (1 - s.z / w) * 2.4;
        const alpha = 1 - s.z / w;
        ctx.fillStyle = `rgba(170, 220, 255, ${alpha})`;
        ctx.fillRect(sx, sy, size, size);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 -z-10 h-full w-full"
    />
  );
}
