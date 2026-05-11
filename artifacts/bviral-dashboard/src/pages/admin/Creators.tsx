import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Users, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface CreatorSummary {
  id: string;
  email: string;
  fullName: string;
  connectedAccountsCount: number;
  unresolvedAlertsCount: number;
  lastActiveAt: string;
}

async function fetchCreators(): Promise<{ data: CreatorSummary[] }> {
  const res = await fetch("/api/v1/admin/creators");

  if (!res.ok) {
    throw new Error("Failed to load creators");
  }

  return res.json() as Promise<{ data: CreatorSummary[] }>;
}

export default function Creators() {
  const [, navigate] = useLocation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "creators"],
    queryFn: fetchCreators,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        Failed to load creators.
      </div>
    );
  }

  const creators = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Content Creators</h2>
        <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
          {creators.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/6">
              <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Creator</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Accounts</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Alerts</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => (
              <tr
                key={creator.id}
                onClick={() => navigate(`/admin/creators/${creator.id}`)}
                onMouseEnter={() => setHoveredId(creator.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "cursor-pointer border-b border-white/4 transition-colors",
                  hoveredId === creator.id ? "bg-white/[0.04]" : "",
                )}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 text-[13px] font-bold text-white">
                      {creator.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{creator.fullName}</p>
                      <p className="text-[12px] text-white/45">{creator.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 text-white/65">
                    <Users className="h-3.5 w-3.5" />
                    <span>{creator.connectedAccountsCount}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {creator.unresolvedAlertsCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="font-semibold">{creator.unresolvedAlertsCount}</span>
                    </div>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-white/50">
                  {new Date(creator.lastActiveAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {creators.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-white/30">
                  No content creators found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
