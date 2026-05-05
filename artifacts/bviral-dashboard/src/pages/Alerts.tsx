import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  ArrowUpDown,
  BellRing,
  Check,
  Info,
  RefreshCcw,
  Search,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import {
  getListAlertsQueryKey,
  useDeleteAlert,
  useListAlerts,
  type Alert,
  type AlertType,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PriorityConfigEntry {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

type AlertPriority = "Critical" | "High" | "Medium" | "Low";
type SortMode = "priority" | "time";
type StatusFilter = "All" | "Unresolved" | "Resolved";

const priorityConfig: Record<AlertPriority, PriorityConfigEntry> = {
  Critical: { icon: AlertOctagon, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", glow: "rgba(239, 68, 68, 0.15)" },
  High: { icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", glow: "rgba(251, 146, 60, 0.1)" },
  Medium: { icon: ShieldAlert, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", glow: "rgba(250, 204, 21, 0.08)" },
  Low: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", glow: "rgba(96, 165, 250, 0.08)" },
};

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const platformLabels = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

function priorityForAlert(alert: Alert): AlertPriority {
  if (alert.type === "error") {
    return "Critical";
  }

  if (alert.type === "copyright") {
    return "High";
  }

  return "Low";
}

function titleForAlert(alert: Alert) {
  const prefix: Record<AlertType, string> = {
    error: "Publishing Error",
    copyright: "Copyright Alert",
    success: "Publishing Success",
  };

  return prefix[alert.type];
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function LoadingAlerts() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="glass-card p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded bg-white/[0.08]" />
              <div className="h-2.5 w-3/4 rounded bg-white/[0.05]" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Alerts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const alertsQuery = useListAlerts();
  const deleteAlertMutation = useDeleteAlert({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      },
      onError: (error) => {
        toast({
          title: "Unable to dismiss alert",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      },
    },
  });
  const [filter, setFilter] = useState<"All" | AlertPriority>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Unresolved");
  const [sort, setSort] = useState<SortMode>("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const alerts = alertsQuery.data?.data ?? [];
  const unresolvedAlerts = alerts.filter((alert) => alert.status === "unresolved");
  const deletingId = deleteAlertMutation.variables?.id;

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return alerts
      .filter((alert) => filter === "All" || priorityForAlert(alert) === filter)
      .filter((alert) => {
        if (statusFilter === "All") {
          return true;
        }

        return statusFilter === "Resolved"
          ? alert.status === "resolved"
          : alert.status === "unresolved";
      })
      .filter((alert) => {
        if (!query) {
          return true;
        }

        return [
          titleForAlert(alert),
          alert.message,
          platformLabels[alert.platform],
          alert.type,
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (sort === "priority") {
          return PRIORITY_ORDER[priorityForAlert(a)] - PRIORITY_ORDER[priorityForAlert(b)];
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [alerts, filter, searchQuery, sort, statusFilter]);

  const handleDismiss = (id: string) => {
    deleteAlertMutation.mutate({ id });
  };

  const handleMarkAllRead = () => {
    for (const alert of unresolvedAlerts) {
      deleteAlertMutation.mutate({ id: alert.id });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-card p-5 bg-gradient-to-r from-primary/[0.06] to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/15"
            style={{ boxShadow: "0 0 20px rgba(124, 58, 237, 0.15)" }}>
            <BellRing className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white">System Alerts</h1>
            <p className="text-muted-foreground/50 text-xs mt-0.5">
              {unresolvedAlerts.length > 0 ? `You have ${unresolvedAlerts.length} unresolved notifications requiring attention.` : "All caught up. No unresolved alerts."}
            </p>
          </div>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={unresolvedAlerts.length === 0 || deleteAlertMutation.isPending}
          className="btn-secondary flex items-center gap-2 text-xs disabled:opacity-30"
        >
          <Check className="w-3.5 h-3.5" />
          Mark All Read
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between glass-card p-2.5 rounded-2xl">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["All", "Unresolved", "Resolved"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                statusFilter === status
                  ? "bg-white text-slate-950"
                  : "bg-white/[0.03] text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70",
              )}
            >
              {status}
            </button>
          ))}
          <div className="w-px bg-white/[0.06] mx-1" />
          {(["All", "Critical", "High", "Medium", "Low"] as const).map((priority) => (
            <button
              key={priority}
              onClick={() => setFilter(priority)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                filter === priority
                  ? "bg-primary text-white"
                  : "bg-white/[0.03] text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70",
              )}
              style={filter === priority ? { boxShadow: "0 0 12px rgba(124, 58, 237, 0.3)" } : undefined}
            >
              {priority}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSort((value) => value === "priority" ? "time" : "priority")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-muted-foreground/60 hover:bg-white/[0.06] hover:text-white/70 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowUpDown className="w-3 h-3" />
            Sort: {sort === "priority" ? "Priority" : "Time"}
          </button>
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search alerts..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-primary/30"
            />
          </div>
        </div>
      </div>

      {alertsQuery.isLoading && <LoadingAlerts />}

      {alertsQuery.isError && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-white/70 font-medium text-sm">Unable to load alerts</p>
          <p className="text-muted-foreground/40 text-xs mt-1">{getErrorMessage(alertsQuery.error)}</p>
          <button onClick={() => alertsQuery.refetch()} className="btn-secondary inline-flex items-center gap-2 mt-5">
            <RefreshCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {!alertsQuery.isLoading && !alertsQuery.isError && (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredAlerts.map((alert, index) => {
              const priority = priorityForAlert(alert);
              const config = priorityConfig[priority];
              const Icon = config.icon;
              const isDeleting = deleteAlertMutation.isPending && deletingId === alert.id;
              const isResolved = alert.status === "resolved";

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0, padding: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  className={cn(
                    "glass-card p-5 border-l-[3px] group hover:bg-white/[0.01] transition-all relative overflow-hidden",
                    config.color.replace("text-", "border-"),
                  )}
                >
                  {priority === "Critical" && (
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none" style={{ backgroundColor: config.glow }} />
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center relative z-10">
                    <div className={cn("p-2.5 rounded-xl border shrink-0", config.bg, config.border)}>
                      <Icon className={cn("w-5 h-5", config.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="text-[15px] font-bold text-white truncate">{titleForAlert(alert)}</h3>
                        <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-white/[0.04] text-white/40 border border-white/[0.06] shrink-0">
                          {alert.type}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] uppercase font-bold border shrink-0",
                          isResolved
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/15"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/15",
                        )}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground/50 text-xs leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0 w-full sm:w-auto justify-between sm:justify-center">
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] font-semibold text-primary/70 mb-0.5">{platformLabels[alert.platform]}</span>
                        <span className="text-[10px] text-muted-foreground/40">{timeAgo(alert.createdAt)}</span>
                      </div>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        disabled={isDeleting || isResolved}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3.5 py-2 rounded-lg transition-all group-hover:border-primary/30 group-hover:text-primary cursor-pointer disabled:opacity-40"
                      >
                        {isResolved ? "Resolved" : isDeleting ? "Resolving..." : "Resolve"} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredAlerts.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-white/60 font-medium text-sm">All clear.</p>
              <p className="text-muted-foreground/40 text-xs mt-1">No alerts matching this criteria.</p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
