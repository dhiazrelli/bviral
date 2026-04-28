import React, { useMemo, useState } from "react";
import { motion, type Variants } from "motion/react";
import { useLocation } from "wouter";
import { useDashboardData } from "@/hooks/use-mock-data";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Gauge,
  Server,
  Sparkles,
  TrendingUp,
  Users,
  Video,
  Wand2,
  XCircle,
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
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  Video,
  Calendar,
  DollarSign,
  AlertTriangle,
  Users,
  TrendingUp,
};

const accentMap: Record<string, string> = {
  Video: "text-primary",
  Calendar: "text-accent",
  DollarSign: "text-emerald-400",
  AlertTriangle: "text-amber-300",
  Users: "text-violet-300",
  TrendingUp: "text-cyan-300",
};

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

const recommendations = [
  {
    title: "Shift more budget into TikTok remix loops",
    detail: "TikTok is outperforming Instagram by 12% in weekly breakout efficiency.",
    icon: Wand2,
  },
  {
    title: "Re-authenticate one Facebook profile",
    detail: "A token issue is blocking one publishing lane and inflating retry load.",
    icon: AlertTriangle,
  },
  {
    title: "Increase weekend queue depth",
    detail: "Saturday demand is rising faster than scheduled inventory for short-form clips.",
    icon: Calendar,
  },
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    isLoading,
    metrics,
    chartData,
    platformDistribution,
    activityFeed,
    systemHealth,
  } = useDashboardData();
  const [chartMode, setChartMode] = useState<"reach" | "revenue">("reach");

  const operationalServices = systemHealth.filter(
    (service) => service.status === "Operational",
  ).length;
  const performanceData = useMemo(() => {
    if (chartMode === "reach") {
      return chartData;
    }

    return chartData.map((entry) => ({
      name: entry.name,
      instagram: Math.round(entry.instagram * 0.82),
      tiktok: Math.round(entry.tiktok * 1.14),
      youtube: Math.round(entry.youtube * 0.91),
    }));
  }, [chartData, chartMode]);

  const yAxisFormatter = (value: number) =>
    chartMode === "reach" ? `${value / 1000}k` : `$${Math.round(value / 100) / 10}k`;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-2 border-white/10 border-t-primary animate-spin" />
          <div className="absolute inset-1 rounded-full border border-accent/40" />
        </div>
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
                Run the content engine like an operating system, not a pile of tabs.
              </h1>
              <p className="page-subtitle mt-4">
                BViral now surfaces queue health, creator throughput, channel mix, and operator
                risk in one command-grade view. The focus is clarity first, then speed.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  navigate("/ai-video-studio");
                  toast({
                    title: "AI Studio",
                    description: "Moved into batch generation.",
                  });
                }}
                className="btn-primary"
              >
                <Wand2 className="h-4 w-4" />
                Launch AI batch
              </button>
              <button
                onClick={() => {
                  navigate("/scheduling");
                  toast({
                    title: "Scheduling",
                    description: "Opening the active publishing queue.",
                  });
                }}
                className="btn-secondary"
              >
                Open publishing queue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">
                  Weekly reach
                </p>
                <p className="mt-2 text-2xl font-display font-bold text-white">18.4M</p>
                <p className="mt-2 text-sm text-emerald-300">+8.1% vs previous week</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">
                  Publish accuracy
                </p>
                <p className="mt-2 text-2xl font-display font-bold text-white">99.3%</p>
                <p className="mt-2 text-sm text-white/56">2 schedules need operator review</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">
                  Revenue velocity
                </p>
                <p className="mt-2 text-2xl font-display font-bold text-white">$106k</p>
                <p className="mt-2 text-sm text-accent">Projected next 7 days</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-slate-950/32 p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/38">
                  Ops Snapshot
                </p>
                <p className="mt-2 text-lg font-display font-bold text-white">
                  Automation is stable
                </p>
              </div>
              <div className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                {operationalServices}/{systemHealth.length} services healthy
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Average publish latency</p>
                    <p className="text-[12px] text-white/52">Measured across all active channels</p>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <p className="text-3xl font-display font-bold text-white">41s</p>
                  <p className="text-sm font-semibold text-emerald-300">-11% today</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/38">
                    At-risk accounts
                  </p>
                  <p className="mt-2 text-2xl font-display font-bold text-white">04</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/38">
                    AI render queue
                  </p>
                  <p className="mt-2 text-2xl font-display font-bold text-white">126</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
      >
        {metrics.map((metric, index) => {
          const Icon = iconMap[metric.icon];

          return (
            <motion.div
              key={metric.title}
              variants={tileVariants}
              whileHover={{ y: -4 }}
              className="stat-card xl:col-span-1"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.05]">
                  <Icon className={cn("h-4.5 w-4.5", accentMap[metric.icon])} />
                </div>
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/62">
                  {metric.change}
                </span>
              </div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/34">
                {metric.title}
              </p>
              <p className="mt-3 text-[2rem] font-display font-bold tracking-[-0.05em] text-white">
                {metric.value}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${62 + index * 6}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          className="glass-card p-6"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/36">
                Channel Performance
              </p>
              <h2 className="mt-2 text-xl font-display font-bold text-white">
                Engagement trend across the last 8 weeks
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] p-1">
              <button
                onClick={() => setChartMode("reach")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-bold transition",
                  chartMode === "reach"
                    ? "bg-white text-slate-950"
                    : "text-white/56 hover:bg-white/[0.06]",
                )}
              >
                Reach
              </button>
              <button
                onClick={() => setChartMode("revenue")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-bold transition",
                  chartMode === "revenue"
                    ? "bg-white text-slate-950"
                    : "text-white/56 hover:bg-white/[0.06]",
                )}
              >
                Revenue
              </button>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reachGradientA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(20 94% 61%)" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="hsl(20 94% 61%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="reachGradientB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(193 92% 56%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(193 92% 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.32)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.32)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={yAxisFormatter}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 18, 34, 0.96)",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    boxShadow: "0 24px 64px rgba(2,10,22,0.45)",
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="instagram"
                  name="Instagram"
                  stroke="hsl(20 94% 61%)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#reachGradientA)"
                />
                <Area
                  type="monotone"
                  dataKey="tiktok"
                  name="TikTok"
                  stroke="hsl(193 92% 56%)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#reachGradientB)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="glass-card p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/36">
            Platform Mix
          </p>
          <h2 className="mt-2 text-xl font-display font-bold text-white">
            Where the engine is spending creative energy
          </h2>
          <div className="relative mt-5 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformDistribution}
                  innerRadius={68}
                  outerRadius={92}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {platformDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 18, 34, 0.96)",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">
                Total
              </p>
              <p className="mt-1 text-4xl font-display font-bold text-white">100%</p>
              <p className="text-sm text-white/46">Creative allocation</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {platformDistribution.map((platform) => (
              <div
                key={platform.name}
                className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: platform.color }}
                />
                <p className="text-sm font-semibold text-white">{platform.name}</p>
                <p className="ml-auto text-sm font-mono text-white/52">{platform.value}%</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.3 }}
          className="glass-card p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">Live Activity</h2>
              <p className="text-[12px] text-white/48">Operator and automation events in sequence</p>
            </div>
          </div>
          <div className="space-y-2">
            {activityFeed.map((item) => {
              const statusIcon =
                item.status === "success"
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  : item.status === "warning"
                    ? <AlertTriangle className="h-4 w-4 text-amber-300" />
                    : item.status === "error"
                      ? <XCircle className="h-4 w-4 text-rose-300" />
                      : <Server className="h-4 w-4 text-accent" />;

              return (
                <div
                  key={item.id}
                  className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] px-4 py-3.5 transition hover:bg-white/[0.05]"
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-slate-950/36">
                      {statusIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-6 text-white">{item.action}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/40">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {item.user}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="glass-card p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/14 text-accent">
              <Server className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">System Health</h2>
              <p className="text-[12px] text-white/48">Service status, uptime, and latency</p>
            </div>
          </div>
          <div className="space-y-3">
            {systemHealth.map((service) => (
              <div
                key={service.service}
                className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="relative mt-1 flex h-3 w-3">
                      {service.status === "Operational" ? (
                        <>
                          <span
                            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-45"
                            style={{ animation: "beacon 1.6s ease-out infinite" }}
                          />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                        </>
                      ) : (
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{service.service}</p>
                      <p className="mt-1 text-[12px] text-white/46">{service.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{service.uptime}</p>
                    <p className="mt-1 text-[12px] text-white/42">{service.ping}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.3 }}
          className="glass-card p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.08] text-white">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">Recommended Moves</h2>
              <p className="text-[12px] text-white/48">What deserves operator attention next</p>
            </div>
          </div>
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.15rem] border border-white/8 bg-white/[0.03] px-4 py-4"
              >
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-primary">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-[12px] leading-5 text-white/48">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.15rem] border border-dashed border-white/10 bg-slate-950/24 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">
              Priority window
            </p>
            <p className="mt-2 text-2xl font-display font-bold text-white">14:00 - 18:00 UTC</p>
            <p className="mt-2 text-sm leading-6 text-white/48">
              Highest probability window for distribution bursts based on the last 21 days of
              channel performance.
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
