import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCcw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi, type FailedJob, type QueueName, type QueueStats } from "@/lib/admin-api";
import { useToast } from "@/hooks/use-toast";
import { AdminDataTable, type AdminDataColumn } from "@/components/admin/AdminDataTable";

const COUNT_KEYS = ["waiting", "active", "delayed", "completed", "failed", "paused"] as const;
type CountKey = (typeof COUNT_KEYS)[number];

const QUEUES: QueueName[] = ["post-publishing", "video-processing", "analytics-refresh", "ai-processing"];

export default function SystemHealth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeQueue, setActiveQueue] = useState<QueueName>("post-publishing");

  const healthQuery = useQuery({
    queryKey: ["admin", "system", "health"],
    queryFn: () => adminApi.systemHealth(),
    refetchInterval: 15000,
  });

  const failedQuery = useQuery({
    queryKey: ["admin", "system", "failed", activeQueue],
    queryFn: () => adminApi.systemFailedJobs(activeQueue, 25),
  });

  const retry = useMutation({
    mutationFn: ({ queue, jobId }: { queue: QueueName; jobId: string }) => adminApi.systemRetryJob(queue, jobId),
    onSuccess: () => {
      toast({ title: "Job re-queued" });
      queryClient.invalidateQueries({ queryKey: ["admin", "system"] });
    },
    onError: (err: Error) => toast({ title: "Retry failed", description: err.message, variant: "destructive" }),
  });

  const queueRows: QueueStats[] = healthQuery.data?.queues ?? QUEUES.map((name) => ({ name, counts: {} }));

  const failedColumns: AdminDataColumn<FailedJob>[] = [
    {
      id: "id",
      header: "Job ID",
      cell: (row) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/80">{row.id}</code>,
    },
    { id: "name", header: "Name", cell: (row) => <span className="text-white/80">{row.name}</span> },
    {
      id: "attempts",
      header: "Attempts",
      cell: (row) => <span className="text-white/65">{row.attemptsMade}</span>,
    },
    {
      id: "failedAt",
      header: "Failed at",
      cell: (row) => (
        <span className="text-white/65">
          {row.finishedOn ? new Date(row.finishedOn).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (row) => (
        <span className="block max-w-[20rem] truncate text-[11px] text-destructive" title={row.failedReason ?? undefined}>
          {row.failedReason ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-white">System health</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            healthQuery.refetch();
            failedQuery.refetch();
          }}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {queueRows.map((queue) => (
          <button
            key={queue.name}
            onClick={() => setActiveQueue(queue.name as QueueName)}
            className={`glass-card rounded-2xl p-5 text-left transition ${
              activeQueue === queue.name ? "ring-1 ring-primary" : ""
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/36">{queue.name}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              {COUNT_KEYS.map((key) => (
                <div key={key} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                  <p className="text-white/40">{key}</p>
                  <p className={`font-bold ${key === "failed" && (queue.counts[key as CountKey] ?? 0) > 0 ? "text-destructive" : "text-white"}`}>
                    {queue.counts[key as CountKey] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white/70">
          Recent failed jobs · <span className="text-primary">{activeQueue}</span>
        </h3>
        <AdminDataTable
          data={failedQuery.data?.jobs ?? []}
          columns={failedColumns}
          rowId={(row) => row.id}
          isLoading={failedQuery.isLoading}
          emptyMessage="No failed jobs in this queue."
          rowActions={(row) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => retry.mutate({ queue: activeQueue, jobId: row.id })}
              disabled={retry.isPending}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        />
      </div>
    </div>
  );
}
