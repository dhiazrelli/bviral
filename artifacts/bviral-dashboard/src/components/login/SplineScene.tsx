/**
 * SplineScene — a static, interactive Spline scene.
 *
 * Loaded from the local file in `public/hands.splinecode` (base-aware so it
 * resolves under any deploy path). The scene stays fixed and does not react to
 * scroll; the user can still interact with it via mouse. To swap scenes, drop a
 * new exported `.splinecode` into public/, or point this at a published
 * `https://prod.spline.design/<id>/scene.splinecode` URL instead.
 */
import Spline from "@splinetool/react-spline";
import { cn } from "@/lib/utils";

export const SPLINE_SCENE_URL = `${import.meta.env.BASE_URL}hands.splinecode`;

export function SplineScene({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full", className)}>
      <Spline scene={SPLINE_SCENE_URL} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default SplineScene;
