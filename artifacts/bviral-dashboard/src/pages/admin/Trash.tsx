import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminPost, type Platform } from "@/lib/admin-api";
import { useAdminListQuery } from "@/hooks/use-admin-list-query";
import { AdminDataTable, type AdminDataColumn } from "@/components/admin/AdminDataTable";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";

const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

const PLATFORM_OPTIONS = (Object.entries(platformLabels) as [Platform, string][]).map(([value, label]) => ({ value, label }));

export default function Trash() {
  const { state, update, setFilter, reset } = useAdminListQuery("/admin/trash");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "trash", state],
    queryFn: () => adminApi.listPosts({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search || undefined,
      sort: "scheduledAt",
      order: "desc",
      onlyDeleted: true,
      creatorId: state.filters.creatorId || undefined,
      platform: (state.filters.platform as Platform) || undefined,
    }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => adminApi.restorePost(id),
    onSuccess: () => {
      toast({ title: "Post restored" });
      queryClient.invalidateQueries({ queryKey: ["admin", "trash"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    },
    onError: (err: Error) => toast({ title: "Restore failed", description: err.message, variant: "destructive" }),
  });

  const columns: AdminDataColumn<AdminPost>[] = [
    {
      id: "deletedAt",
      header: "Removed",
      cell: (row) => <span className="text-white/75">{row.deletedAt ? new Date(row.deletedAt).toLocaleString() : "—"}</span>,
    },
    {
      id: "creator",
      header: "Creator",
      cell: (row) => (
        <div>
          <p className="font-medium text-white">{row.creator.fullName}</p>
          <p className="text-[11px] text-white/40">{row.creator.email}</p>
        </div>
      ),
    },
    {
      id: "account",
      header: "Account",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{platformLabels[row.platform]}</Badge>
          <span className="text-white/80">{row.account.accountName}</span>
        </div>
      ),
    },
    {
      id: "scheduledAt",
      header: "Was scheduled for",
      cell: (row) => <span className="text-white/65">{new Date(row.scheduledAt).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trash2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Trash</h2>
        {query.data?.pagination ? (
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
            {query.data.pagination.total}
          </span>
        ) : null}
      </div>

      <AdminFilterBar
        search={state.search}
        onSearchChange={(value) => update({ search: value, page: 1 })}
        searchPlaceholder="Search by creator, account, or filename…"
        filters={[
          {
            id: "platform",
            label: "Platform",
            value: state.filters.platform ?? "",
            options: PLATFORM_OPTIONS,
            onChange: (value) => setFilter("platform", value || null),
          },
        ]}
        onReset={reset}
      />

      <AdminDataTable<AdminPost>
        data={query.data?.data ?? []}
        columns={columns}
        rowId={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage="Nothing in trash."
        pagination={query.data?.pagination}
        onPageChange={(page) => update({ page })}
        rowActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => restore.mutate(row.id)}
            disabled={restore.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore
          </Button>
        )}
      />
    </div>
  );
}
