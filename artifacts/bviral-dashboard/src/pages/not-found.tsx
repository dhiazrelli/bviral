import { Link } from "wouter";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center">
      <div className="text-center">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <h1 className="text-[120px] font-display font-black text-white/[0.03] leading-none select-none">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/15 animate-float"
              style={{ boxShadow: '0 0 40px rgba(124, 58, 237, 0.15)' }}>
              <AlertCircle className="w-9 h-9 text-primary" />
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-display font-bold text-white mb-3">Page Not Found</h2>
        <p className="text-sm text-muted-foreground/50 max-w-sm mx-auto mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <Link href="/">
          <button className="btn-primary inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
