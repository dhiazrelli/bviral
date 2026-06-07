import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, BarChart3, Play, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountPlatform, AnalyticsOverview } from "@workspace/api-client-react";

const platformLabels: Record<AccountPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const platformBadge: Record<AccountPlatform, string> = {
  tiktok: "bg-cyan-500/10 text-cyan-400 border-cyan-500/15",
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/15",
  youtube: "bg-red-500/10 text-red-400 border-red-500/15",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/15",
  snapchat: "bg-yellow-500/10 text-yellow-400 border-yellow-500/15",
};

const platformDisplay: Record<AccountPlatform, {
  abbr: string;
  color: string;
  bg: string;
  barColor: string;
}> = {
  instagram: { abbr: "IG", color: "text-pink-400", bg: "bg-pink-500/8 border-pink-500/15", barColor: "bg-pink-400" },
  tiktok: { abbr: "TT", color: "text-cyan-400", bg: "bg-cyan-500/8 border-cyan-500/15", barColor: "bg-cyan-400" },
  youtube: { abbr: "YT", color: "text-red-400", bg: "bg-red-500/8 border-red-500/15", barColor: "bg-red-400" },
  facebook: { abbr: "FB", color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/15", barColor: "bg-blue-400" },
  snapchat: { abbr: "SC", color: "text-yellow-400", bg: "bg-yellow-500/8 border-yellow-500/15", barColor: "bg-yellow-400" },
};

const tooltipStyle = {
  backgroundColor: "rgba(10, 10, 18, 0.95)",
  borderColor: "rgba(255,255,255,0.06)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

const emptyTotals = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  revenue: 0,
  posts: 0,
  engagementRate: 0,
};

export function normalizeAnalytics(analytics: Partial<AnalyticsOverview> | undefined): AnalyticsOverview {
  return {
    totals: { ...emptyTotals, ...analytics?.totals },
    byPlatform: analytics?.byPlatform ?? [],
    timeline: analytics?.timeline ?? [],
    topPosts: analytics?.topPosts ?? [],
  };
}

function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function AnalyticsCharts({ analytics }: { analytics: AnalyticsOverview }) {
  const lineData = useMemo(
    () => analytics.timeline.slice(-30).map((point) => ({
      day: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(point.date)),
      views: point.views,
      likes: point.likes,
      comments: point.comments,
      shares: point.shares,
    })),
    [analytics.timeline],
  );

  const barData = useMemo(
    () => analytics.byPlatform.map((platform) => ({
      name: platformLabels[platform.platform],
      views: platform.views,
      likes: platform.likes,
    })),
    [analytics.byPlatform],
  );

  const maxPlatformViews = Math.max(...analytics.byPlatform.map((platform) => platform.views), 1);
  const hasAnalytics = analytics.totals.posts > 0;

  const kpis = [
    {
      label: "Total Views",
      value: formatCompact(analytics.totals.views),
      sub: `${analytics.totals.posts} posts tracked`,
      icon: BarChart3,
      color: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-t-primary",
    },
    {
      label: "Avg Engagement Rate",
      value: formatPercent(analytics.totals.engagementRate),
      sub: `${formatCompact(analytics.totals.likes + analytics.totals.comments + analytics.totals.shares)} interactions`,
      icon: TrendingUp,
      color: "from-accent/20 to-accent/5",
      iconColor: "text-accent",
      borderColor: "border-t-accent",
    },
    {
      label: "Total Revenue",
      value: `$${formatCompact(analytics.totals.revenue)}`,
      sub: `${formatCompact(analytics.totals.shares)} shares recorded`,
      icon: ArrowUpRight,
      color: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-400",
      borderColor: "border-t-emerald-500",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`glass-card p-5 border-t-2 ${kpi.borderColor}`}
          >
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs text-muted-foreground/50">{kpi.label}</p>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center border border-white/[0.04]`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} />
              </div>
            </div>
            <h3 className="text-3xl font-display font-extrabold text-white mb-2 tracking-tight">{kpi.value}</h3>
            <p className="text-[11px] flex items-center font-semibold text-emerald-400">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              {kpi.sub}
            </p>
          </motion.div>
        ))}
      </div>

      {!hasAnalytics ? (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <BarChart3 className="w-7 h-7 text-muted-foreground/25" />
          </div>
          <p className="text-white/70 font-medium text-sm">No analytics snapshots match the current filters</p>
          <p className="text-muted-foreground/40 text-xs mt-1">Try widening the date range or selecting a different creator.</p>
        </div>
      ) : null}

      <div className="glass-card p-5">
        <h3 className="font-display font-bold text-white text-sm mb-4">Platform comparison</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {analytics.byPlatform.map((platform) => {
            const display = platformDisplay[platform.platform];
            const bar = Math.round((platform.views / maxPlatformViews) * 100);
            return (
              <div key={platform.platform} className={`rounded-xl border p-4 flex flex-col gap-3 ${display.bg}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${display.color}`}>{platformLabels[platform.platform]}</span>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black border ${display.bg} ${display.color}`}>{display.abbr}</span>
                </div>
                <div>
                  <p className="text-lg font-display font-extrabold text-white">{formatCompact(platform.views)}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">views</p>
                </div>
                <div className="w-full bg-black/20 rounded-full h-1">
                  <div className={`h-1 rounded-full ${display.barColor}`} style={{ width: `${bar}%` }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground/50">{formatCompact(platform.likes + platform.comments + platform.shares)} eng.</span>
                  <span className="text-emerald-400 font-semibold">{platform.posts} posts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-5 h-[380px] flex flex-col">
          <h3 className="font-display font-bold text-white text-sm mb-4">Engagement trajectory</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompact(Number(value))} />
                <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fff", fontSize: "11px" }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                <Line type="monotone" dataKey="views" name="Views" stroke="hsl(262, 83%, 58%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="likes" name="Likes" stroke="hsl(185, 85%, 48%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="comments" name="Comments" stroke="hsl(330, 75%, 60%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5 h-[380px] flex flex-col">
          <h3 className="font-display font-bold text-white text-sm mb-4">Views vs likes by platform</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompact(Number(value))} />
                <RechartsTooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.02)" }} itemStyle={{ color: "#fff", fontSize: "11px" }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                <Bar dataKey="views" name="Views" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="likes" name="Likes" fill="hsl(185, 85%, 48%)" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-display font-bold text-white text-sm mb-5">Top performing videos</h3>
        <div className="space-y-3">
          {analytics.topPosts.length === 0 ? (
            <div className="py-10 text-center">
              <Play className="w-5 h-5 mx-auto text-muted-foreground/25 mb-2" />
              <p className="text-xs text-muted-foreground/40">No ranked posts yet.</p>
            </div>
          ) : null}
          {analytics.topPosts.map((post, index) => (
            <div key={post.postId} className="flex items-center gap-3 group p-2 rounded-xl hover:bg-white/[0.02] transition-colors -mx-2">
              <span className="text-xl font-display font-black text-white/[0.06] w-5 shrink-0 text-center">{index + 1}</span>
              <div className="w-9 h-12 bg-black/30 rounded-lg border border-white/[0.06] flex items-center justify-center shrink-0">
                <Play className="w-2.5 h-2.5 text-muted-foreground/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 font-medium text-[12px] truncate">{post.externalPostId ?? post.postId}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${platformBadge[post.platform]}`}>{platformLabels[post.platform]}</span>
                  <span className="text-[10px] text-muted-foreground/40">{formatCompact(post.views)} views</span>
                </div>
              </div>
              <span className="text-primary font-bold text-xs shrink-0">{formatPercent(post.engagementRate)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
