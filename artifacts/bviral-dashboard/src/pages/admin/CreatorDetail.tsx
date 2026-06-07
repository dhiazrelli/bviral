import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Globe } from "lucide-react";
import { useGetCreator, customFetch, type PostsCollection } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi, type AdminPost } from "@/lib/admin-api";
import { AdminDataTable, type AdminDataColumn } from "@/components/admin/AdminDataTable";
import { AnalyticsCharts, normalizeAnalytics } from "@/components/analytics/AnalyticsCharts";

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

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
  const creatorQuery = useGetCreator(id);

  const scheduleQuery = useQuery({
    queryKey: ["admin", "creator-schedule", id],
    queryFn: () => customFetch<PostsCollection>(`/api/v1/admin/creators/${id}/schedule`),
  });

  const postsQuery = useQuery({
    queryKey: ["admin", "creator-posts", id],
    queryFn: () => adminApi.listPosts({ creatorId: id, pageSize: 50, includeDeleted: true }),
  });

  const postColumns: AdminDataColumn<AdminPost>[] = useMemo(() => [
    {
      id: "scheduledAt",
      header: "Scheduled",
      cell: (row) => <span className="text-white/70">{new Date(row.scheduledAt).toLocaleString()}</span>,
    },
    {
      id: "platform",
      header: "Platform",
      cell: (row) => <Badge variant="outline">{platformLabels[row.platform] ?? row.platform}</Badge>,
    },
    {
      id: "account",
      header: "Account",
      cell: (row) => <span className="text-white/80">{row.account.accountName}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        if (row.deletedAt) return <Badge variant="destructive">Removed</Badge>;
        if (row.status === "posted") return <Badge variant="secondary">Posted</Badge>;
        if (row.status === "failed") return <Badge variant="destructive">Failed</Badge>;
        if (row.status === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
        return <Badge>Scheduled</Badge>;
      },
    },
  ], []);

  if (creatorQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (creatorQuery.error || !creatorQuery.data) {
    return <div className="flex h-64 items-center justify-center text-destructive">Creator not found.</div>;
  }

  const data = creatorQuery.data;
  const totals = data.analytics.totals;
  const suspended = Boolean(data.suspendedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/creators")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{data.fullName}</h2>
            {suspended ? <Badge variant="destructive">Suspended</Badge> : null}
          </div>
          <p className="text-[12px] text-white/45">{data.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Views" value={totals.views.toLocaleString()} />
        <StatCard label="Total Posts" value={totals.posts} />
        <StatCard label="Engagement" value={`${totals.engagementRate}%`} />
        <StatCard label="Revenue" value={`$${totals.revenue.toFixed(2)}`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({data.accounts.length})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Profile</h3>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between border-b border-white/6 pb-2">
                <dt className="text-white/45">Created</dt>
                <dd className="text-white/80">{new Date(data.createdAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between border-b border-white/6 pb-2">
                <dt className="text-white/45">Connected accounts</dt>
                <dd className="text-white/80">{data.accounts.length}</dd>
              </div>
              {suspended ? (
                <div className="flex justify-between border-b border-white/6 pb-2">
                  <dt className="text-white/45">Suspended at</dt>
                  <dd className="text-white/80">{new Date(data.suspendedAt!).toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="mt-5">
          <div className="glass-card rounded-2xl p-5">
            {data.accounts.length === 0 ? (
              <p className="text-sm text-white/30">No connected accounts.</p>
            ) : (
              <div className="space-y-3">
                {data.accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.06]">
                        <Globe className="h-4 w-4 text-white/50" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{account.accountName}</p>
                        <p className="text-[12px] text-white/45">{platformLabels[account.platform] ?? account.platform}</p>
                      </div>
                    </div>
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
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="mt-5">
          <AdminDataTable
            data={postsQuery.data?.data ?? []}
            columns={postColumns}
            rowId={(row) => row.id}
            isLoading={postsQuery.isLoading || scheduleQuery.isLoading}
            emptyMessage="No scheduled posts for this creator."
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-5">
          <AnalyticsCharts analytics={normalizeAnalytics(data.analytics)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
