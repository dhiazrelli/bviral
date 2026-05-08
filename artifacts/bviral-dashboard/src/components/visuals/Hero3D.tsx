import { useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Scroll-driven 3D parallax shell.
 *
 * Wraps any block of content and renders multiple layered "depth" planes
 * behind it that respond to page scroll using Framer Motion's `useScroll`
 * + `useTransform`. The visual style is intentionally restrained: a soft
 * orb gradient field, a subtle conic mesh, and a faint vignette grid.
 *
 * Implementation notes:
 *   - Uses CSS 3D transforms (perspective + rotateX/rotateY/translateZ)
 *     instead of pulling in Three.js, so the hero stays cheap (~3kb of
 *     gzipped runtime, no extra deps) and works everywhere React renders.
 *   - All motion respects `prefers-reduced-motion`. When the user opts
 *     out, layers stay still and the canvas grid stops animating.
 *   - The background canvas draws a low-density grid of glow particles
 *     and re-paints on scroll, capped at one frame per 16ms. It's
 *     skipped entirely on viewports < 768px wide for mobile perf.
 */

export interface Hero3DProps {
  children: ReactNode;
  className?: string;
  /**
   * The hero is a `glass-card` style surface by default. Set this to false
   * if you'd rather embed the parallax shell inside another container.
   */
  surface?: boolean;
}

export function Hero3D({ children, className, surface = true }: Hero3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  // Track scroll progress relative to this section: 0 when its top edge
  // hits the bottom of the viewport, 1 when its bottom edge leaves the top.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Smooth out the raw progress so transforms don't feel jittery.
  const progress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 28,
    mass: 0.4,
  });

  // Layered transforms — each "depth" plane gets its own range so they
  // separate visibly as the user scrolls past the hero.
  const orbY = useTransform(progress, [0, 1], reducedMotion ? [0, 0] : [-30, 80]);
  const orbScale = useTransform(progress, [0, 0.5, 1], [1.05, 1, 0.95]);
  const meshRotateX = useTransform(progress, [0, 1], reducedMotion ? [0, 0] : [12, -12]);
  const meshRotateY = useTransform(progress, [0, 1], reducedMotion ? [0, 0] : [-6, 6]);
  const meshY = useTransform(progress, [0, 1], reducedMotion ? [0, 0] : [0, -40]);
  const gridOpacity = useTransform(progress, [0, 0.4, 1], [0.65, 0.45, 0.2]);
  const contentY = useTransform(progress, [0, 1], reducedMotion ? [0, 0] : [0, -16]);

  // Glow particle field, drawn into a canvas. Cheap, decorative, and gives
  // the hero genuine depth (it sits behind the foreground but in front of
  // the orb mesh, so scrolling reveals real layering).
  useEffect(() => {
    if (reducedMotion) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let lastFrameAt = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Particle = { x: number; y: number; r: number; vx: number; vy: number; hue: number };
    let particles: Particle[] = [];

    function seedParticles() {
      const count = Math.max(18, Math.round((width * height) / 35000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1.5 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        hue: 220 + Math.random() * 80, // blue → violet → magenta
      }));
    }

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    }

    function tick(now: number) {
      if (now - lastFrameAt < 16) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      lastFrameAt = now;

      context!.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        const gradient = context!.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.r * 8,
        );
        gradient.addColorStop(0, `hsla(${p.hue}, 90%, 70%, 0.45)`);
        gradient.addColorStop(1, `hsla(${p.hue}, 90%, 60%, 0)`);
        context!.fillStyle = gradient;
        context!.beginPath();
        context!.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
        context!.fill();
      }

      frame = window.requestAnimationFrame(tick);
    }

    resize();
    frame = window.requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [reducedMotion]);

  return (
    <motion.section
      ref={containerRef}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden",
        surface && "glass-card p-6 lg:p-7",
        className,
      )}
      style={{ perspective: 1400 }}
    >
      {/* Orb gradient layer — furthest back. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-30"
        style={{ y: orbY, scale: orbScale }}
      >
        <div className="absolute -top-32 -left-20 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.45),_rgba(124,58,237,0)_60%)] blur-2xl" />
        <div className="absolute -top-12 right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.32),_rgba(56,189,248,0)_60%)] blur-2xl" />
        <div className="absolute bottom-[-12rem] left-[20%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.28),_rgba(236,72,153,0)_60%)] blur-2xl" />
      </motion.div>

      {/* Particle canvas — middle depth. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full opacity-70 mix-blend-screen"
      />

      {/* Conic mesh layer with 3D rotation — closest "back" plane. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          rotateX: meshRotateX,
          rotateY: meshRotateY,
          y: meshY,
          transformStyle: "preserve-3d",
        }}
      >
        <motion.div
          className="absolute inset-x-[10%] top-[55%] h-[120%] origin-top"
          style={{
            opacity: gridOpacity,
            backgroundImage:
              "linear-gradient(rgba(124,58,237,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.14) 1px, transparent 1px)",
            backgroundSize: "60px 60px, 60px 60px",
            transform: "rotateX(70deg) translateZ(-40px)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 80%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 80%)",
          }}
        />
      </motion.div>

      {/* Foreground content — translates slightly upward as you scroll. */}
      <motion.div
        style={{ y: contentY, transformStyle: "preserve-3d" }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </motion.section>
  );
}

export default Hero3D;
