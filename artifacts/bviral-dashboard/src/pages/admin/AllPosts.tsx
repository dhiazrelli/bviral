import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Download, MoreHorizontal, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminPost, type Platform, type PostStatus } from "@/lib/admin-api";
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

const STATUS_OPTIONS: Array<{ value: PostStatus; label: string }> = [
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

type Confirm =
  | { kind: "delete"; post: AdminPost }
  | { kind: "bulk-delete"; ids: string[] }
  | null;

export default function AllPosts() {
  const { state, update, setFilter, reset } = useAdminListQuery("/admin/posts");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const query = useQuery({
    queryKey: ["admin", "posts", state],
    queryFn: () => adminApi.listPosts({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search || undefined,
      sort: (state.sort as "scheduledAt" | "createdAt") ?? "scheduledAt",
      order: state.order ?? "desc",
      creatorId: state.filters.creatorId || undefined,
      platform: (state.filters.platform as Platform) || undefined,
      status: (state.filters.status as PostStatus) || undefined,
      accountId: state.filters.accountId || undefined,
      from: state.filters.from ? new Date(state.filters.from).toISOString() : undefined,
      to: state.filters.to ? new Date(state.filters.to).toISOString() : undefined,
    }),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) => adminApi.softDeletePost(id),
    onSuccess: () => {
      toast({ title: "Post moved to trash" });
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      setConfirm(null);
    },
    onError: (err: Error) => toast({ title: "Remove failed", description: err.message, variant: "destructive" }),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => adminApi.bulkDeletePosts(ids),
    onSuccess: (result) => {
      toast({ title: `${result.count} posts moved to trash` });
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      setSelectedIds([]);
      setConfirm(null);
    },
    onError: (err: Error) => toast({ title: "Bulk delete failed", description: err.message, variant: "destructive" }),
  });

  const columns: AdminDataColumn<AdminPost>[] = [
    {
      id: "scheduledAt",
      header: "Scheduled",
      sortKey: "scheduledAt",
      cell: (row) => <span className="text-white/75">{new Date(row.scheduledAt).toLocaleString()}</span>,
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
      id: "video",
      header: "Video",
      cell: (row) => <span className="text-white/65">{row.video.originalFilename ?? row.video.id.slice(0, 8)}</span>,
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
  ];

  const exportHref = adminApi.analyticsCsvUrl({
    creatorId: state.filters.creatorId,
    platform: state.filters.platform,
    from: state.filters.from ? new Date(state.filters.from).toISOString() : undefined,
    to: state.filters.to ? new Date(state.filters.to).toISOString() : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-white">All scheduled posts</h2>
          {query.data?.pagination ? (
            <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
              {query.data.pagination.total}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirm({ kind: "bulk-delete", ids: selectedIds })}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Bulk remove ({selectedIds.length})
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}>
              <Download className="mr-2 h-4 w-4" />
              Export analytics CSV
            </a>
          </Button>
        </div>
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
          {
            id: "status",
            label: "Status",
            value: state.filters.status ?? "",
            options: STATUS_OPTIONS,
            onChange: (value) => setFilter("status", value || null),
          },
        ]}
        dateRange={{
          from: state.filters.from ?? "",
          to: state.filters.to ?? "",
          onChange: (from, to) => update({ filters: { from, to }, page: 1 }),
        }}
        onReset={reset}
      />

      <AdminDataTable<AdminPost>
        data={query.data?.data ?? []}
        columns={columns}
        rowId={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage={query.isError ? "Failed to load posts." : "No posts match your filters."}
        selectable
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        sort={state.sort ? { id: state.sort, order: state.order ?? "desc" } : undefined}
        onSortChange={(next) => update({ sort: next?.id, order: next?.order })}
        pagination={query.data?.pagination}
        onPageChange={(page) => update({ page })}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm({ kind: "delete", post: row })}
                disabled={Boolean(row.deletedAt)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove (soft delete)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        {confirm ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm.kind === "bulk-delete"
                  ? `Remove ${confirm.ids.length} posts?`
                  : "Remove this post?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Removed posts are hidden from the creator and won't be published. You can restore them from Trash.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={softDelete.isPending || bulkDelete.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirm.kind === "delete"
                  ? softDelete.mutate(confirm.post.id)
                  : bulkDelete.mutate(confirm.ids)}
                disabled={softDelete.isPending || bulkDelete.isPending}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </div>
  );
}
