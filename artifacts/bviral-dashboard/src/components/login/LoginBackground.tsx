/**
 * LoginBackground — orbital 3D scene rendered via Canvas API.
 * Designed to be swapped for an @react-three/fiber version once R3F v9
 * (with React 19 support) is stable.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const PLATFORM_COLORS = ["#9333ea", "#e1306c", "#ff0000", "#1877f2", "#fffc00"];
const PLATFORM_LABELS = ["T", "IG", "YT", "FB", "SC"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  alpha: number;
}

interface PlatformSprite {
  label: string;
  color: string;
  ring: 0 | 1;
  offset: number;
}

const SPRITES: PlatformSprite[] = [
  { label: "T", color: "#ffffff", ring: 0, offset: 0 },
  { label: "IG", color: "#e1306c", ring: 0, offset: Math.PI * 2 / 3 },
  { label: "YT", color: "#ff0000", ring: 0, offset: (Math.PI * 2 / 3) * 2 },
  { label: "FB", color: "#1877f2", ring: 1, offset: 0 },
  { label: "SC", color: "#fffc00", ring: 1, offset: Math.PI },
];

export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const mouse = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;

    let particles: Particle[] = [];
    let targetMx = 0.5;
    let targetMy = 0.5;
    let smoothMx = 0.5;
    let smoothMy = 0.5;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      cx = width / 2;
      cy = height / 2;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    }

    function seedParticles() {
      const count = reducedMotion ? 0 : Math.max(20, Math.floor((width * height) / 18000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 2,
        hue: 260 + Math.random() * 80,
        alpha: 0.2 + Math.random() * 0.4,
      }));
    }

    function drawParticle(p: Particle) {
      const grd = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      grd.addColorStop(0, `hsla(${p.hue},90%,70%,${p.alpha})`);
      grd.addColorStop(1, `hsla(${p.hue},90%,60%,0)`);
      ctx!.fillStyle = grd;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawRing(
      cx2: number,
      cy2: number,
      rx: number,
      ry: number,
      tiltFactor: number,
    ) {
      ctx!.save();
      ctx!.globalAlpha = 0.07;
      ctx!.strokeStyle = "#ffffff";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        const x = cx2 + Math.cos(angle) * rx;
        const y = cy2 + Math.sin(angle) * ry * tiltFactor;
        i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
      }
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }

    function drawSprite(
      x: number,
      y: number,
      label: string,
      color: string,
    ) {
      const r = Math.min(width, height) * 0.032;
      ctx!.save();
      ctx!.globalAlpha = 0.9;
      ctx!.fillStyle = color;
      ctx!.shadowColor = color;
      ctx!.shadowBlur = 16;
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = label === "SC" ? "#000" : "#fff";
      ctx!.font = `bold ${r * 0.9}px system-ui`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText(label, x, y);
      ctx!.restore();
    }

    function drawScene(now: number) {
      ctx!.clearRect(0, 0, width, height);

      const dt = reducedMotion ? 0 : 0.016;
      t += dt;

      if (!reducedMotion) {
        smoothMx += (targetMx - smoothMx) * 0.04;
        smoothMy += (targetMy - smoothMy) * 0.04;
      }

      const parallaxX = (smoothMx - 0.5) * 30;
      const parallaxY = (smoothMy - 0.5) * 20;

      // particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
        drawParticle(p);
      }

      const baseRx = Math.min(width, height) * 0.32;
      const scx = cx + parallaxX;
      const scy = cy + parallaxY;

      // ring 0 (outer, tilted more)
      drawRing(scx, scy, baseRx, baseRx, 0.38);
      // ring 1 (inner, less tilt)
      drawRing(scx, scy, baseRx * 0.62, baseRx * 0.62, 0.6);

      // platform icons
      for (const sprite of SPRITES) {
        const ringRx = sprite.ring === 0 ? baseRx : baseRx * 0.62;
        const tiltFactor = sprite.ring === 0 ? 0.38 : 0.6;
        const rotationSpeed = sprite.ring === 0 ? t * 0.3 : t * -0.5;
        const angle = sprite.offset + rotationSpeed;
        const x = scx + Math.cos(angle) * ringRx;
        const y = scy + Math.sin(angle) * ringRx * tiltFactor;
        drawSprite(x, y, sprite.label, sprite.color);
      }

      animFrame = requestAnimationFrame(drawScene);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    animFrame = requestAnimationFrame(drawScene);

    function onMouseMove(e: MouseEvent) {
      if (!reducedMotion) {
        targetMx = e.clientX / window.innerWidth;
        targetMy = e.clientY / window.innerHeight;
      }
    }

    window.addEventListener("mousemove", onMouseMove);

    return () => {
      cancelAnimationFrame(animFrame);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ background: "transparent" }}
      aria-hidden
    />
  );
}
