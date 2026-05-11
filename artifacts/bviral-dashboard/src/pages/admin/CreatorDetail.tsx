import { ArrowLeft, CheckCircle2, Clock, Globe, Link2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

interface AccountMeta {
  id: string;
  platform: string;
  accountName: string;
  tokenExpiry: string | null;
  ownerKind: "user" | "bviral_company";
  userId: string | null;
  createdAt: string;
}

interface CreatorDetailData {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  accounts: AccountMeta[];
  analytics: {
    totals: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      revenue: number;
      posts: number;
      engagementRate: number;
    };
  };
}

async function fetchCreatorDetail(id: string): Promise<CreatorDetailData> {
  const res = await fetch(`/api/v1/admin/creators/${id}`);

  if (!res.ok) {
    throw new Error("Creator not found");
  }

  return res.json() as Promise<CreatorDetailData>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function CreatorDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "creators", id],
    queryFn: () => fetchCreatorDetail(id),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        Creator not found.
      </div>
    );
  }

  const totals = data.analytics.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/admin/creators")}
          className="rounded-xl border border-white/8 bg-white/[0.04] p-2 text-white/60 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{data.fullName}</h2>
          <p className="text-[12px] text-white/45">{data.email}</p>
        </div>
      </div>

      {/* Analytics stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Views" value={totals.views.toLocaleString()} />
        <StatCard label="Total Posts" value={totals.posts} />
        <StatCard label="Engagement" value={`${totals.engagementRate}%`} />
        <StatCard label="Revenue" value={`$${totals.revenue.toFixed(2)}`} />
      </div>

      {/* Connected accounts — metadata only, no tokens */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">
          Connected Accounts
        </h3>
        {data.accounts.length === 0 ? (
          <p className="text-sm text-white/30">No connected accounts.</p>
        ) : (
          <div className="space-y-3">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.06]">
                    <Globe className="h-4 w-4 text-white/50" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{account.accountName}</p>
                    <p className="text-[12px] text-white/45">{platformLabels[account.platform] ?? account.platform}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.tokenExpiry ? (
                    <div className="flex items-center gap-1.5 text-[12px] text-white/45">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Expires {new Date(account.tokenExpiry).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Active</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
