import { useState } from "react";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SplineScene } from "@/components/login/SplineScene";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import bviralLogo from "../../../../bviral.png";

/**
 * Login.
 *
 * Left half: a single, non-scrolling panel — brand line + sign-in form, all
 * fitted to the viewport. Right half: a fixed Spline 3D scene that dissolves
 * into the left column through a wide, feathered seam. On small screens the
 * Spline panel is dropped and the form stacks over the aurora backdrop.
 */
export default function Login() {
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const reducedMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError, role: resolvedRole } = await signIn(email, password);

    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    if (resolvedRole === "admin") {
      navigate("/admin/creators");
    } else {
      navigate("/");
    }
  };

  // Sequential fade-up for the brand + form, staggered top to bottom.
  const item = {
    hidden: reducedMotion ? {} : { opacity: 0, y: 16 },
    visible: (i: number) =>
      reducedMotion
        ? {}
        : {
            opacity: 1,
            y: 0,
            transition: { delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
          },
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground lg:h-screen">
      {/* One quiet warm wash behind everything — no second hue, no neon. */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-[4%] h-[46rem] w-[46rem] rounded-full bg-[radial-gradient(circle_at_center,_hsl(20_80%_45%_/_0.1),_transparent_62%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1700px] flex-col lg:h-screen lg:flex-row">
        {/* ───────────────── LEFT: brand + sign-in (fits the viewport) ───────────────── */}
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-10 lg:h-screen lg:w-[44%] lg:px-16 xl:px-24">
          <div className="w-full max-w-md">
            <motion.img
              src={bviralLogo}
              alt="BViral"
              custom={0}
              variants={item}
              initial="hidden"
              animate="visible"
              className="mb-10 h-10 w-auto drop-shadow-[0_8px_24px_rgba(255,146,74,0.3)]"
            />

            <motion.p
              custom={1}
              variants={item}
              initial="hidden"
              animate="visible"
              className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40"
            >
              Operator Access
            </motion.p>

            <motion.h1
              custom={2}
              variants={item}
              initial="hidden"
              animate="visible"
              className="mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"
            >
              Stop making content.{" "}
              <span className="text-primary">Start making it spread.</span>
            </motion.h1>

            <motion.p
              custom={3}
              variants={item}
              initial="hidden"
              animate="visible"
              className="mt-5 text-lg text-white/60"
            >
              The control center for creators who post everywhere at once.
            </motion.p>

            {/* Sign-in form */}
            <motion.form
              onSubmit={handleSubmit}
              custom={4}
              variants={item}
              initial="hidden"
              animate="visible"
              className="mt-10 space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@bviral.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-primary/50"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white/70">
                    Password
                  </Label>
                  <a
                    href="mailto:ops@bviral.com"
                    className="text-[12px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-primary/50"
                />
              </div>

              {error ? (
                <motion.p
                  initial={reducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
                >
                  {error}
                </motion.p>
              ) : null}

              <motion.div whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </motion.div>

              <p className="text-center text-[12px] text-white/40">
                Access is by invitation only.
              </p>
            </motion.form>
          </div>
        </div>

        {/* ───────────────── RIGHT: fixed Spline (never scrolls) ───────────────── */}
        <div className="relative hidden lg:block lg:w-[56%]">
          {/* The scene is scaled up and pushed right so the vivid hands/phone sit
              away from the seam; only a narrow left band is feathered, keeping
              the scene itself bright and crisp. */}
          <div className="h-screen w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.5)_9%,#000_20%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.5)_9%,#000_20%)]">
            <div className="h-full w-full origin-right [transform:scale(1.12)_translateX(4%)]">
              <SplineScene />
            </div>
          </div>
          {/* Narrow vignette right at the seam so the edge settles into the dark. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-background via-background/55 to-transparent" />
          {/* A single warm bloom riding the seam so the transition reads as intentional. */}
          <div className="pointer-events-none absolute top-[42%] -left-20 h-80 w-56 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,_hsl(20_80%_45%_/_0.14),transparent_72%)] blur-3xl" />
        </div>
      </div>
    </div>
  );
}
