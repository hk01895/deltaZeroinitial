"use client";

import { useEffect, useRef } from "react";

// Neon confetti burst for Δ 0. Subtle palette to match the theme.
// Bump `fire` (any changing number) to launch a burst.
const COLORS = ["#67e8f9", "#a5f3fc", "#6ee7b7", "#34d399", "#c4b5fd", "#e2e8f0", "#7dd3fc"];

type P = { x: number; y: number; vx: number; vy: number; r: number; w: number; h: number; rot: number; vr: number; c: string; life: number; round: boolean };

export default function Celebration({ fire, originY = 0.28 }: { fire: number; originY?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    if (!canvas) return;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch {
      /* ignore */
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const small = W < 640;
    const count = small ? 90 : 160;
    const ox = W / 2;
    const oy = H * originY;
    const parts: P[] = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (small ? 4 : 6) + Math.random() * (small ? 6 : 9);
      parts.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (small ? 3 : 4),
        r: 1.5 + Math.random() * 2.5,
        w: 4 + Math.random() * 5,
        h: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
        round: Math.random() < 0.35,
      });
    }

    let raf = 0;
    const start = performance.now();
    const DURATION = 3200;
    const tick = (t: number) => {
      const k = (t - start) / DURATION;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.18;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - k);
        ctx.save();
        ctx.globalAlpha = p.life * 0.9;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.c;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (k < 1) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, originY]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50" />;
}
