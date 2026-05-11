import { useState } from "react";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LoginBackground } from "@/components/login/LoginBackground";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import bviralLogo from "../../../../bviral.png";

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

  const fieldVariants = {
    hidden: reducedMotion ? {} : { opacity: 0, y: 14 },
    visible: (i: number) => reducedMotion
      ? {}
      : { opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.3 } },
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#02080e]">
      {/* Aurora gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-[5%] h-[50rem] w-[50rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.22),_transparent_60%)] blur-3xl" />
        <div className="absolute -bottom-32 right-[8%] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.18),_transparent_60%)] blur-3xl" />
      </div>

      {/* R3F 3D scene */}
      <div className="pointer-events-none absolute inset-0">
        <LoginBackground />
      </div>

      {/* Glassmorphic card */}
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm px-4"
      >
        <Card className="border-white/10 bg-white/[0.06] shadow-[0_32px_80px_rgba(2,10,22,0.6)] backdrop-blur-2xl ring-1 ring-inset ring-white/8">
          <CardHeader className="items-center pb-2 pt-8">
            <img
              src={bviralLogo}
              alt="BViral"
              className="mb-4 h-10 w-auto drop-shadow-[0_8px_24px_rgba(255,146,74,0.3)]"
            />
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/36">
              Operator Access
            </p>
            <h1 className="mt-1 text-center text-2xl font-bold text-white">
              Sign in to BViral
            </h1>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div
                custom={0}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
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
                  className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-primary/50"
                />
              </motion.div>

              <motion.div
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="password" className="text-white/70">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus-visible:ring-primary/50"
                />
              </motion.div>

              {error ? (
                <motion.p
                  initial={reducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[13px] text-red-400"
                >
                  {error}
                </motion.p>
              ) : null}

              <motion.div
                custom={2}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                >
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary font-semibold text-slate-950 shadow-[0_4px_20px_rgba(124,58,237,0.4)] hover:bg-primary/90"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : "Sign in"}
                  </Button>
                </motion.div>
              </motion.div>

              <motion.p
                custom={3}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="text-center text-[12px] text-white/40"
              >
                Access is by invitation only.{" "}
                <a
                  href="mailto:ops@bviral.com"
                  className="text-white/60 underline underline-offset-2 hover:text-white/80"
                >
                  Forgot password?
                </a>
              </motion.p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
