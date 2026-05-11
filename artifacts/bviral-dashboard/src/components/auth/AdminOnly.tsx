import { Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (role !== "admin") {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
