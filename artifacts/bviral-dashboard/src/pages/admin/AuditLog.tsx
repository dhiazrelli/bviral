import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { adminApi, type AdminAuditEntry } from "@/lib/admin-api";
import { useAdminListQuery } from "@/hooks/use-admin-list-query";
import { AdminDataTable, type AdminDataColumn } from "@/components/admin/AdminDataTable";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";

const TARGET_OPTIONS = [
  { value: "user", label: "User" },
  { value: "post", label: "Post" },
  { value: "video", label: "Video" },
  { value: "account", label: "Account" },
  { value: "system", label: "System" },
];

export default function AuditLog() {
  const { state, update, setFilter, reset } = useAdminListQuery("/admin/audit-log");

  const query = useQuery({
    queryKey: ["admin", "audit", state],
    queryFn: () => adminApi.listAuditLog({
      page: state.page,
      pageSize: state.pageSize,
      action: state.search || undefined,
      targetType: (state.filters.targetType as "user" | "post" | "video" | "account" | "system") || undefined,
      from: state.filters.from ? new Date(state.filters.from).toISOString() : undefined,
      to: state.filters.to ? new Date(state.filters.to).toISOString() : undefined,
    }),
  });

  const columns: AdminDataColumn<AdminAuditEntry>[] = [
    {
      id: "createdAt",
      header: "When",
      cell: (row) => <span className="text-white/75">{new Date(row.createdAt).toLocaleString()}</span>,
    },
    {
      id: "admin",
      header: "Admin",
      cell: (row) => (
        <div>
          <p className="font-medium text-white">{row.adminName ?? "—"}</p>
          <p className="text-[11px] text-white/40">{row.adminEmail ?? row.adminId}</p>
        </div>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/80">{row.action}</code>,
    },
    {
      id: "target",
      header: "Target",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{row.targetType}</Badge>
          <span className="text-[11px] text-white/45">{row.targetId ?? "—"}</span>
        </div>
      ),
    },
    {
      id: "payload",
      header: "Payload",
      cell: (row) => (
        <pre className="max-w-[20rem] overflow-x-auto rounded bg-black/30 px-2 py-1 text-[11px] text-white/60">
          {Object.keys(row.payload).length === 0 ? "—" : JSON.stringify(row.payload)}
        </pre>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Admin audit log</h2>
        {query.data?.pagination ? (
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
            {query.data.pagination.total}
          </span>
        ) : null}
      </div>

      <AdminFilterBar
        search={state.search}
        onSearchChange={(value) => update({ search: value, page: 1 })}
        searchPlaceholder="Filter by action (e.g. creator.suspend)…"
        filters={[
          {
            id: "targetType",
            label: "Target",
            value: state.filters.targetType ?? "",
            options: TARGET_OPTIONS,
            onChange: (value) => setFilter("targetType", value || null),
          },
        ]}
        dateRange={{
          from: state.filters.from ?? "",
          to: state.filters.to ?? "",
          onChange: (from, to) => update({ filters: { from, to }, page: 1 }),
        }}
        onReset={reset}
      />

      <AdminDataTable<AdminAuditEntry>
        data={query.data?.data ?? []}
        columns={columns}
        rowId={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage={query.isError ? "Failed to load audit log." : "No audit entries match your filters."}
        pagination={query.data?.pagination}
        onPageChange={(page) => update({ page })}
      />
    </div>
  );
}
