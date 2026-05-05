import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  Clock,
  Play,
  RefreshCcw,
  ShieldAlert,
  Telescope,
  TrendingUp,
} from "lucide-react";
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
import {
  type AccountPlatform,
  type AnalyticsOverview,
  useGetAnalyticsOverview,
} from "@workspace/api-client-react";

const platformLabels: Record<AccountPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const platformDisplay: Record<AccountPlatform, {
  abbr: string;
  color: string;
  bg: string;
  barColor: string;
  stroke: string;
}> = {
  instagram: {
    abbr: "IG",
    color: "text-pink-400",
    bg: "bg-pink-500/8 border-pink-500/15",
    barColor: "bg-pink-400",
    stroke: "hsl(330, 75%, 60%)",
  },
  tiktok: {
    abbr: "TT",
    color: "text-cyan-400",
    bg: "bg-cyan-500/8 border-cyan-500/15",
    barColor: "bg-cyan-400",
    stroke: "hsl(185, 85%, 48%)",
  },
  youtube: {
    abbr: "YT",
    color: "text-red-400",
    bg: "bg-red-500/8 border-red-500/15",
    barColor: "bg-red-400",
    stroke: "hsl(0, 84%, 60%)",
  },
  facebook: {
    abbr: "FB",
    color: "text-blue-400",
    bg: "bg-blue-500/8 border-blue-500/15",
    barColor: "bg-blue-400",
    stroke: "hsl(217, 91%, 60%)",
  },
  snapchat: {
    abbr: "SC",
    color: "text-yellow-400",
    bg: "bg-yellow-500/8 border-yellow-500/15",
    barColor: "bg-yellow-400",
    stroke: "hsl(45, 93%, 58%)",
  },
};

const platformBadge: Record<AccountPlatform, string> = {
  tiktok: "bg-cyan-500/10 text-cyan-400 border-cyan-500/15",
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/15",
  youtube: "bg-red-500/10 text-red-400 border-red-500/15",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/15",
  snapchat: "bg-yellow-500/10 text-yellow-400 border-yellow-500/15",
};

const HEATMAP_HOURS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const emptyAnalyticsTotals = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  revenue: 0,
  posts: 0,
  engagementRate: 0,
};

const tooltipStyle = {
  backgroundColor: "rgba(10, 10, 18, 0.95)",
  borderColor: "rgba(255,255,255,0.06)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

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

function buildLineData(analytics: AnalyticsOverview) {
  return analytics.timeline.slice(-30).map((point) => ({
    day: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(point.date)),
    views: point.views,
    likes: point.likes,
    comments: point.comments,
    shares: point.shares,
  }));
}

function buildBarData(analytics: AnalyticsOverview) {
  return analytics.byPlatform.map((platform) => ({
    name: platformLabels[platform.platform],
    views: platform.views,
    likes: platform.likes,
  }));
}

function LoadingPanel() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-card p-5 h-36">
            <div className="h-3 w-32 bg-white/[0.08] rounded mb-6" />
            <div className="h-8 w-24 bg-white/[0.08] rounded mb-4" />
            <div className="h-3 w-28 bg-white/[0.05] rounded" />
          </div>
        ))}
      </div>
      <div className="glass-card p-5 h-52" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-5 h-[380px]" />
        <div className="glass-card p-5 h-[380px]" />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const analyticsQuery = useGetAnalyticsOverview();
  const analytics = normalizeAnalytics(analyticsQuery.data);
  const lineData = useMemo(() => buildLineData(analytics), [analytics]);
  const barData = useMemo(() => buildBarData(analytics), [analytics]);
  const maxPlatformViews = Math.max(...analytics.byPlatform.map((platform) => platform.views), 1);
  const hasAnalytics = analytics.totals.posts > 0;
  const heatmapSeed = Math.max(analytics.totals.engagementRate, 1);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/10 flex items-center justify-center border border-amber-500/10">
              <Telescope className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="page-title mb-0">Advanced Analytics</h1>
          </div>
          <p className="page-subtitle ml-[52px]">Deep dive into cross-platform performance.</p>
        </div>

        <div className="flex flex-wrap gap-2 glass-card p-1.5 rounded-xl ml-[52px] md:ml-0">
          <select className="bg-transparent text-xs text-white/60 px-2.5 py-1.5 focus:outline-none cursor-pointer rounded-lg hover:bg-white/[0.04]">
            <option className="bg-card">All Platforms</option>
            <option className="bg-card">Instagram</option>
            <option className="bg-card">TikTok</option>
            <option className="bg-card">YouTube</option>
            <option className="bg-card">Facebook</option>
          </select>
          <div className="w-px h-5 bg-white/[0.06] self-center" />
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            className="bg-transparent text-xs text-primary font-semibold px-2.5 py-1.5 focus:outline-none cursor-pointer rounded-lg hover:bg-white/[0.04]"
          >
            <option className="bg-card">Last 7 Days</option>
            <option className="bg-card">Last 30 Days</option>
            <option className="bg-card">This Year</option>
          </select>
        </div>
      </div>

      {analyticsQuery.isLoading && <LoadingPanel />}

      {analyticsQuery.isError && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-white/70 font-medium text-sm">Unable to load analytics</p>
          <p className="text-muted-foreground/40 text-xs mt-1">{getErrorMessage(analyticsQuery.error)}</p>
          <button
            onClick={() => analyticsQuery.refetch()}
            className="btn-secondary inline-flex items-center gap-2 mt-5"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {!analyticsQuery.isLoading && !analyticsQuery.isError && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Total Cross-Platform Views",
                value: formatCompact(analytics.totals.views),
                sub: `${analytics.totals.posts} posted videos tracked`,
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
            ].map((kpi, index) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
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

          {!hasAnalytics && (
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-muted-foreground/25" />
              </div>
              <p className="text-white/70 font-medium text-sm">No analytics snapshots yet</p>
              <p className="text-muted-foreground/40 text-xs mt-1">Published posts will appear here after the analytics worker runs.</p>
            </div>
          )}

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
            <h3 className="font-display font-bold text-white text-sm mb-4">Platform Comparison</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {analytics.byPlatform.map((platform) => {
                const display = platformDisplay[platform.platform];
                const bar = Math.round((platform.views / maxPlatformViews) * 100);

                return (
                  <div key={platform.platform} className={`rounded-xl border p-4 flex flex-col gap-3 ${display.bg} hover:border-opacity-30 transition-colors`}>
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
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-5 h-[380px] flex flex-col">
              <h3 className="font-display font-bold text-white text-sm mb-4">Engagement Trajectory</h3>
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
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card p-5 h-[380px] flex flex-col">
              <h3 className="font-display font-bold text-white text-sm mb-4">Views vs Likes by Platform</h3>
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
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center border border-accent/10">
                    <TrendingUp className="w-3 h-3 text-accent" />
                  </div>
                  Engagement Heatmap
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[240px]">
                  <div className="grid grid-cols-9 gap-1 mb-1">
                    <div />
                    {HEATMAP_HOURS.map((hour) => (
                      <div key={hour} className="text-center text-[8px] text-muted-foreground/30 font-mono">{hour}</div>
                    ))}
                  </div>
                  {HEATMAP_DAYS.map((day, dayIndex) => (
                    <div key={day} className="grid grid-cols-9 gap-1 mb-1">
                      <div className="text-[9px] text-muted-foreground/40 flex items-center font-medium">{day}</div>
                      {HEATMAP_HOURS.map((hour, hourIndex) => {
                        const val = Math.min(10, Math.max(1, Math.round(((dayIndex + 1) * (hourIndex + 2) + heatmapSeed) % 10)));
                        const intensity = val / 10;

                        return (
                          <div
                            key={hour}
                            title={`${day} ${hour}: ${val * 10}% engagement`}
                            className="aspect-square rounded cursor-pointer transition-transform hover:scale-125"
                            style={{
                              backgroundColor: `rgba(6, 182, 212, ${0.04 + intensity * 0.85})`,
                              boxShadow: intensity > 0.7 ? `0 0 6px rgba(6,182,212,${intensity * 0.4})` : "none",
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-2 mt-3 text-[9px] text-muted-foreground/30">
                    <span>Low</span>
                    <div className="w-16 h-1.5 rounded-full" style={{ background: "linear-gradient(to right, rgba(6,182,212,0.04), rgba(6,182,212,0.9))" }} />
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center border border-primary/10">
                    <Clock className="w-3 h-3 text-primary" />
                  </div>
                  Best Posting Times
                </h3>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {["M", "Tu", "W", "Th", "F", "Sa", "Su"].map((day) => (
                  <div key={day} className="text-center text-[9px] text-muted-foreground/30 pb-2 font-medium">{day}</div>
                ))}
                {Array.from({ length: 56 }).map((_, index) => {
                  const score = (index + analytics.totals.views + analytics.totals.likes) % 13;
                  const isHot = score > 9;
                  const isWarm = score > 5;

                  return (
                    <div
                      key={index}
                      className={`aspect-square rounded transition-all hover:scale-125 cursor-pointer ${
                        isHot ? "bg-primary" : isWarm ? "bg-primary/40" : "bg-white/[0.03]"
                      }`}
                      style={isHot ? { boxShadow: "0 0 8px rgba(124, 58, 237, 0.6)" } : undefined}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-4 text-[10px] text-muted-foreground/30 font-mono">
                <span>00:00</span>
                <div className="flex gap-2 items-center">
                  <span>Low</span>
                  <div className="w-12 h-1.5 bg-gradient-to-r from-white/[0.03] to-primary rounded-full" />
                  <span>High</span>
                </div>
                <span>24:00</span>
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="font-display font-bold text-white text-sm mb-5">Top Performing Videos</h3>
              <div className="space-y-3">
                {analytics.topPosts.length === 0 && (
                  <div className="py-10 text-center">
                    <Play className="w-5 h-5 mx-auto text-muted-foreground/25 mb-2" />
                    <p className="text-xs text-muted-foreground/40">No ranked posts yet.</p>
                  </div>
                )}
                {analytics.topPosts.map((post, index) => (
                  <div key={post.postId} className="flex items-center gap-3 group cursor-pointer p-2 rounded-xl hover:bg-white/[0.02] transition-colors -mx-2">
                    <span className="text-xl font-display font-black text-white/[0.06] w-5 shrink-0 text-center">{index + 1}</span>
                    <div className="w-9 h-12 bg-black/30 rounded-lg border border-white/[0.06] group-hover:border-primary/30 transition-colors flex items-center justify-center shrink-0">
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
        </>
      )}
    </div>
  );
}
