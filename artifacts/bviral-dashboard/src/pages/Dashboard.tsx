import React, { useMemo, useState } from "react";
import { motion, type Variants } from "motion/react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type AccountPlatform,
  type AnalyticsOverview,
  useGetAnalyticsOverview,
  useListAccounts,
  useListAlerts,
  useListPosts,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const platformLabels: Record<AccountPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const platformColors: Record<AccountPlatform, string> = {
  instagram: "var(--color-chart-1)",
  tiktok: "var(--color-chart-2)",
  youtube: "var(--color-chart-3)",
  facebook: "var(--color-chart-4)",
  snapchat: "var(--color-chart-5)",
};

const emptyAnalyticsTotals = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  revenue: 0,
  posts: 0,
  engagementRate: 0,
};

function normalizeAnalytics(analytics: Partial<AnalyticsOverview> | undefined): AnalyticsOverview {
  return {
    totals: {
      ...emptyAnalyticsTotals,
      ...analytics?.totals,
    },
    byPlatform: analytics?.byPlatform ?? [],
    timeline: analytics?.timeline ?? [],
    topPosts: analytics?.topPosts ?? [],
  };
}

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 220, damping: 22 },
  },
};

const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function LoadingDashboard() {
  return (
    <div className="space-y-6 pb-10 animate-pulse">
      <div className="glass-card h-72 p-6" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="stat-card h-40" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="glass-card h-[420px]" />
        <div className="glass-card h-[420px]" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const accountsQuery = useListAccounts();
  const postsQuery = useListPosts();
  const alertsQuery = useListAlerts();
  const analyticsQuery = useGetAnalyticsOverview();
  const [chartMode, setChartMode] = useState<"reach" | "engagement">("reach");

  const isLoading = accountsQuery.isLoading || postsQuery.isLoading || alertsQuery.isLoading || analyticsQuery.isLoading;
  const isError = accountsQuery.isError || postsQuery.isError || alertsQuery.isError || analyticsQuery.isError;
  const error = accountsQuery.error ?? postsQuery.error ?? alertsQuery.error ?? analyticsQuery.error;
  const accounts = accountsQuery.data?.data ?? [];
  const posts = postsQuery.data?.data ?? [];
  const alerts = alertsQuery.data?.data ?? [];
  const unresolvedAlerts = alerts.filter((alert) => alert.status === "unresolved");
  const analytics = normalizeAnalytics(analyticsQuery.data);
  const scheduledPosts = posts.filter((post) => post.status === "scheduled");
  const postedPosts = posts.filter((post) => post.status === "posted");
  const failedPosts = posts.filter((post) => post.status === "failed");
  const expiredAccounts = accounts.filter((account) =>
    account.tokenExpiry ? new Date(account.tokenExpiry).getTime() <= Date.now() : false,
  );

  const chartData = useMemo(() => {
    return analytics.timeline.slice(-8).map((point) => ({
      name: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(point.date)),
      reach: point.views,
      engagement: point.likes + point.comments + point.shares,
    }));
  }, [analytics.timeline]);

  const platformDistribution = useMemo(() => {
    const source = analytics.byPlatform;
    const total = source.reduce((sum, platform) => sum + platform.views, 0);

    return source
      .filter((platform) => platform.posts > 0 || platform.views > 0)
      .map((platform) => ({
        name: platformLabels[platform.platform],
        value: total > 0 ? Math.round((platform.views / total) * 100) : 0,
        color: platformColors[platform.platform],
      }));
  }, [analytics.byPlatform]);

  const recentAlerts = unresolvedAlerts.slice(0, 5);
  const metrics = [
    { title: "Total Accounts", value: formatCompact(accounts.length), detail: `${expiredAccounts.length} need attention`, icon: Users, accent: "text-violet-300" },
    { title: "Scheduled Posts", value: formatCompact(scheduledPosts.length), detail: `${postedPosts.length} already posted`, icon: Calendar, accent: "text-accent" },
    { title: "Total Views", value: formatCompact(analytics.totals.views), detail: `${analytics.totals.posts} tracked posts`, icon: BarChart3, accent: "text-primary" },
    { title: "Total Revenue", value: `$${formatCompact(analytics.totals.revenue)}`, detail: `${formatCompact(analytics.totals.likes)} likes`, icon: DollarSign, accent: "text-emerald-400" },
    { title: "Open Alerts", value: formatCompact(unresolvedAlerts.length), detail: `${alerts.length - unresolvedAlerts.length} resolved`, icon: AlertTriangle, accent: "text-amber-300" },
    { title: "Engagement", value: `${analytics.totals.engagementRate.toFixed(1)}%`, detail: `${formatCompact(analytics.totals.comments + analytics.totals.shares)} comments/shares`, icon: TrendingUp, accent: "text-cyan-300" },
  ];

  const yAxisFormatter = (value: number) => formatCompact(value);

  if (isLoading) {
    return <LoadingDashboard />;
  }

  if (isError) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-white/70 font-medium text-sm">Unable to load dashboard</p>
        <p className="text-muted-foreground/40 text-xs mt-1">{getErrorMessage(error)}</p>
        <button
          onClick={() => {
            accountsQuery.refetch();
            postsQuery.refetch();
            alertsQuery.refetch();
            analyticsQuery.refetch();
          }}
          className="btn-secondary inline-flex items-center gap-2 mt-5"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass-card overflow-hidden p-6 lg:p-7"
      >
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div>
            <div className="surface-label mb-4">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Growth Control Room
            </div>
            <div className="max-w-3xl">
              <h1 className="page-title">
                Run the content engine from live platform, schedule, alert, and analytics signals.
              </h1>
              <p className="page-subtitle mt-4">
                BViral is now reading the real API layer for account coverage, scheduled queue depth, incident load, and cross-platform performance.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  navigate("/ai-video-studio");
                  toast({ title: "AI Studio", description: "Moved into batch generation." });
                }}
                className="btn-primary"
              >
                <Wand2 className="h-4 w-4" />
                Launch AI batch
              </button>
              <button
                onClick={() => {
                  navigate("/scheduling");
                  toast({ title: "Scheduling", description: "Opening the active publishing queue." });
                }}
                className="btn-secondary"
              >
                Open publishing queue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Total reach</p>
                <p className="mt-2 text-2xl font-display font-bold text-white">{formatCompact(analytics.totals.views)}</p>
                <p className="mt-2 text-sm text-emerald-300">{analytics.totals.posts} posts tracked</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Queue depth</p>
                <p className="mt-2 text-2xl font-display font-bold text-white">{scheduledPosts.length}</p>
                <p className="mt-2 text-sm text-white/56">scheduled posts</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Alert load</p>
                <p className="mt-2 text-2xl font-display font-bold text-white">{unresolvedAlerts.length}</p>
                <p className="mt-2 text-sm text-accent">current notifications</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-slate-950/32 p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/38">Ops Snapshot</p>
                <p className="mt-2 text-lg font-display font-bold text-white">Live API data is flowing</p>
              </div>
              <div className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                {accounts.length} accounts
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Accounts API", value: `${accounts.length} loaded`, ok: !accountsQuery.isError },
                { label: "Posts API", value: `${posts.length} loaded`, ok: !postsQuery.isError },
                { label: "Alerts API", value: `${unresolvedAlerts.length} unresolved`, ok: !alertsQuery.isError },
                { label: "Analytics API", value: `${analytics.totals.posts} snapshots`, ok: !analyticsQuery.isError },
              ].map((service) => (
                <div key={service.label} className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={cn("h-4 w-4", service.ok ? "text-emerald-300" : "text-amber-300")} />
                      <p className="text-sm font-semibold text-white">{service.label}</p>
                    </div>
                    <p className="text-sm font-mono text-white/56">{service.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div variants={listVariants} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric, index) => (
          <motion.div key={metric.title} variants={tileVariants} whileHover={{ y: -4 }} className="stat-card xl:col-span-1">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.05]">
                <metric.icon className={cn("h-4.5 w-4.5", metric.accent)} />
              </div>
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/62">
                Live
              </span>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/34">{metric.title}</p>
            <p className="mt-3 text-[2rem] font-display font-bold tracking-[-0.05em] text-white">{metric.value}</p>
            <p className="mt-2 text-[12px] text-white/44">{metric.detail}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.min(94, 52 + index * 7)}%` }} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.3 }} className="glass-card p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/36">Channel Performance</p>
              <h2 className="mt-2 text-xl font-display font-bold text-white">Analytics trend from saved snapshots</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] p-1">
              {(["reach", "engagement"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-bold capitalize transition",
                    chartMode === mode ? "bg-white text-slate-950" : "text-white/56 hover:bg-white/[0.06]",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardMetricGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(20 94% 61%)" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="hsl(20 94% 61%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.32)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.32)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} />
                <RechartsTooltip contentStyle={{ backgroundColor: "rgba(10, 18, 34, 0.96)", borderColor: "rgba(255,255,255,0.08)", borderRadius: "18px", color: "#fff" }} />
                <Area type="monotone" dataKey={chartMode} name={chartMode === "reach" ? "Reach" : "Engagement"} stroke="hsl(20 94% 61%)" strokeWidth={2.5} fillOpacity={1} fill="url(#dashboardMetricGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.3 }} className="glass-card p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/36">Platform Mix</p>
          <h2 className="mt-2 text-xl font-display font-bold text-white">Distribution from analytics views</h2>
          <div className="relative mt-5 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformDistribution} innerRadius={68} outerRadius={92} paddingAngle={4} dataKey="value" stroke="none">
                  {platformDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: "rgba(10, 18, 34, 0.96)", borderColor: "rgba(255,255,255,0.08)", borderRadius: "18px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">Total</p>
              <p className="mt-1 text-4xl font-display font-bold text-white">{formatCompact(analytics.totals.views)}</p>
              <p className="text-sm text-white/46">views</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {platformDistribution.length === 0 && <p className="text-sm text-white/46">No platform analytics yet.</p>}
            {platformDistribution.map((platform) => (
              <div key={platform.name} className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: platform.color }} />
                <p className="text-sm font-semibold text-white">{platform.name}</p>
                <p className="ml-auto text-sm font-mono text-white/52">{platform.value}%</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.3 }} className="glass-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">Recent Alerts</h2>
              <p className="text-[12px] text-white/48">Newest system notifications from the API</p>
            </div>
          </div>
          <div className="space-y-2">
            {recentAlerts.length === 0 && <p className="text-sm text-white/46">No active alerts.</p>}
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] px-4 py-3.5 transition hover:bg-white/[0.05]">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-slate-950/36">
                    <AlertTriangle className={cn("h-4 w-4", alert.type === "success" ? "text-emerald-300" : "text-amber-300")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-6 text-white">{alert.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/40">
                      <span>{platformLabels[alert.platform]}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(alert.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }} className="glass-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/14 text-accent">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">Recommended Moves</h2>
              <p className="text-[12px] text-white/48">Derived from the current API state</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              unresolvedAlerts.length > 0
                ? `Review ${unresolvedAlerts.length} unresolved alert${unresolvedAlerts.length === 1 ? "" : "s"} before the next publishing run.`
                : "No open alerts. Keep the queue moving.",
              expiredAccounts.length > 0
                ? `Reconnect ${expiredAccounts.length} account${expiredAccounts.length === 1 ? "" : "s"} with expired tokens.`
                : "Connected account tokens look current.",
              scheduledPosts.length > 0
                ? `${scheduledPosts.length} scheduled post${scheduledPosts.length === 1 ? "" : "s"} are ready for the worker.`
                : "The scheduled queue is empty.",
            ].map((detail) => (
              <div key={detail} className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold text-white">{detail}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
