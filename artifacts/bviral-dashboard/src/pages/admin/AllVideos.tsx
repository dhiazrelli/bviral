import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileVideo, MoreHorizontal, Trash2 } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminVideo, type VideoStatus } from "@/lib/admin-api";
import { useAdminListQuery } from "@/hooks/use-admin-list-query";
import { AdminDataTable, type AdminDataColumn } from "@/components/admin/AdminDataTable";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";

const STATUS_OPTIONS: Array<{ value: VideoStatus; label: string }> = [
  { value: "uploaded", label: "Uploaded" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

function statusBadge(status: VideoStatus) {
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (status === "processing") return <Badge>Processing</Badge>;
  return <Badge variant="outline">Uploaded</Badge>;
}

export default function AllVideos() {
  const { state, update, setFilter, reset } = useAdminListQuery("/admin/videos");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminVideo | null>(null);

  const query = useQuery({
    queryKey: ["admin", "videos", state],
    queryFn: () => adminApi.listVideos({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search || undefined,
      sort: (state.sort as "createdAt" | "duration") ?? "createdAt",
      order: state.order ?? "desc",
      creatorId: state.filters.creatorId || undefined,
      status: (state.filters.status as VideoStatus) || undefined,
      from: state.filters.from ? new Date(state.filters.from).toISOString() : undefined,
      to: state.filters.to ? new Date(state.filters.to).toISOString() : undefined,
    }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "video", openVideoId],
    queryFn: () => adminApi.getVideo(openVideoId!),
    enabled: Boolean(openVideoId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteVideo(id),
    onSuccess: () => {
      toast({ title: "Video deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin", "videos"] });
      setConfirmDelete(null);
      setOpenVideoId(null);
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const columns: AdminDataColumn<AdminVideo>[] = [
    {
      id: "createdAt",
      header: "Uploaded",
      sortKey: "createdAt",
      cell: (row) => <span className="text-white/75">{new Date(row.createdAt).toLocaleString()}</span>,
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
      id: "filename",
      header: "File",
      cell: (row) => <span className="text-white/80">{row.originalFilename ?? row.id.slice(0, 8)}</span>,
    },
    {
      id: "duration",
      header: "Duration",
      sortKey: "duration",
      cell: (row) => <span className="text-white/65">{row.duration ? `${row.duration}s` : "—"}</span>,
    },
    {
      id: "posts",
      header: "Posts",
      cell: (row) => <span className="text-white/65">{row.postsCount}</span>,
    },
    {
      id: "views",
      header: "Views",
      cell: (row) => <span className="text-white/65">{row.totalViews.toLocaleString()}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => statusBadge(row.status),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileVideo className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-white">All uploaded videos</h2>
        {query.data?.pagination ? (
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
            {query.data.pagination.total}
          </span>
        ) : null}
      </div>

      <AdminFilterBar
        search={state.search}
        onSearchChange={(value) => update({ search: value, page: 1 })}
        searchPlaceholder="Search by filename…"
        filters={[
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

      <AdminDataTable<AdminVideo>
        data={query.data?.data ?? []}
        columns={columns}
        rowId={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage={query.isError ? "Failed to load videos." : "No videos match your filters."}
        sort={state.sort ? { id: state.sort, order: state.order ?? "desc" } : undefined}
        onSortChange={(next) => update({ sort: next?.id, order: next?.order })}
        pagination={query.data?.pagination}
        onPageChange={(page) => update({ page })}
        onRowClick={(row) => setOpenVideoId(row.id)}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setOpenVideoId(row.id)}>View detail</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmDelete(row)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete (permanent)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Sheet open={Boolean(openVideoId)} onOpenChange={(open) => !open && setOpenVideoId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detailQuery.data?.originalFilename ?? "Video"}</SheetTitle>
            <SheetDescription>
              Uploaded by {detailQuery.data?.creator.fullName ?? "—"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-4 text-sm">
            {detailQuery.isLoading ? (
              <p className="text-white/40">Loading…</p>
            ) : detailQuery.data ? (
              <>
                <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                  {detailQuery.data.processedUrl || detailQuery.data.originalUrl ? (
                    <video
                      src={detailQuery.data.processedUrl ?? detailQuery.data.originalUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full rounded-xl"
                    />
                  ) : (
                    <p className="text-white/40">No playable URL.</p>
                  )}
                </div>
                <dl className="grid gap-2">
                  <div className="flex justify-between border-b border-white/6 pb-1.5">
                    <dt className="text-white/45">Status</dt>
                    <dd>{statusBadge(detailQuery.data.status)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-white/6 pb-1.5">
                    <dt className="text-white/45">Duration</dt>
                    <dd className="text-white/80">{detailQuery.data.duration ? `${detailQuery.data.duration}s` : "—"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-white/6 pb-1.5">
                    <dt className="text-white/45">Active posts</dt>
                    <dd className="text-white/80">{detailQuery.data.postsCount}</dd>
                  </div>
                  <div className="flex justify-between border-b border-white/6 pb-1.5">
                    <dt className="text-white/45">Total views</dt>
                    <dd className="text-white/80">{detailQuery.data.totalViews.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between border-b border-white/6 pb-1.5">
                    <dt className="text-white/45">Uploaded</dt>
                    <dd className="text-white/80">{new Date(detailQuery.data.createdAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-destructive">Video not found.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        {confirmDelete ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete video permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the video and cascades to {confirmDelete.postsCount} associated post{confirmDelete.postsCount === 1 ? "" : "s"}.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
              >
                Delete forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </div>
  );
}
