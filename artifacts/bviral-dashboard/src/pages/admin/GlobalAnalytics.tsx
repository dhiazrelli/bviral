import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi, type Platform } from "@/lib/admin-api";
import { useAdminListQuery } from "@/hooks/use-admin-list-query";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AnalyticsCharts, normalizeAnalytics } from "@/components/analytics/AnalyticsCharts";

const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "snapchat", label: "Snapchat" },
];

export default function GlobalAnalytics() {
  const { state, update, setFilter, reset } = useAdminListQuery("/admin/analytics");
  const params = {
    creatorId: state.filters.creatorId || undefined,
    accountId: state.filters.accountId || undefined,
    postId: state.filters.postId || undefined,
    videoId: state.filters.videoId || undefined,
    platform: (state.filters.platform as Platform) || undefined,
    from: state.filters.from ? new Date(state.filters.from).toISOString() : undefined,
    to: state.filters.to ? new Date(state.filters.to).toISOString() : undefined,
  };

  const overview = useQuery({
    queryKey: ["admin", "analytics", params],
    queryFn: () => adminApi.analyticsOverview(params),
  });

  const csvHref = adminApi.analyticsCsvUrl(params);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-white">Global analytics</h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={csvHref}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <AdminFilterBar
        search={state.filters.creatorId ?? ""}
        onSearchChange={(value) => setFilter("creatorId", value || null)}
        searchPlaceholder="Filter by creator ID (UUID)…"
        filters={[
          {
            id: "platform",
            label: "Platform",
            value: state.filters.platform ?? "",
            options: PLATFORM_OPTIONS,
            onChange: (value) => setFilter("platform", value || null),
          },
        ]}
        dateRange={{
          from: state.filters.from ?? "",
          to: state.filters.to ?? "",
          onChange: (from, to) => update({ filters: { from, to } }),
        }}
        onReset={reset}
      />

      {overview.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : overview.isError ? (
        <p className="text-destructive">Failed to load analytics.</p>
      ) : (
        <AnalyticsCharts analytics={normalizeAnalytics(overview.data)} />
      )}
    </div>
  );
}
