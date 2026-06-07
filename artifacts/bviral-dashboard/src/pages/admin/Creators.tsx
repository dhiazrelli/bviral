import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  MoreHorizontal,
  Pause,
  Play,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminCreator } from "@/lib/admin-api";
import { useAdminListQuery } from "@/hooks/use-admin-list-query";
import { AdminDataTable, type AdminDataColumn } from "@/components/admin/AdminDataTable";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { InviteCreatorDialog } from "@/components/admin/InviteCreatorDialog";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

type ConfirmTarget = { kind: "delete" | "suspend" | "reactivate"; creator: AdminCreator } | null;

export default function Creators() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { state, update, setFilter, reset } = useAdminListQuery("/admin/creators");
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);

  const status = (state.filters.status ?? "all") as "all" | "active" | "suspended";

  const creatorsQuery = useQuery({
    queryKey: ["admin", "creators", state],
    queryFn: () => adminApi.listCreators({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search || undefined,
      sort: (state.sort as "createdAt" | "fullName" | "email" | "lastActiveAt") ?? "createdAt",
      order: state.order ?? "desc",
      status,
    }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => adminApi.suspendCreator(id),
    onSuccess: () => {
      toast({ title: "Creator suspended" });
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
      setConfirm(null);
    },
    onError: (err: Error) => toast({ title: "Suspend failed", description: err.message, variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.reactivateCreator(id),
    onSuccess: () => {
      toast({ title: "Creator reactivated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
      setConfirm(null);
    },
    onError: (err: Error) => toast({ title: "Reactivate failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCreator(id),
    onSuccess: () => {
      toast({ title: "Creator deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
      setConfirm(null);
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const data = creatorsQuery.data?.data ?? [];
  const pagination = creatorsQuery.data?.pagination;

  const columns: AdminDataColumn<AdminCreator>[] = [
    {
      id: "creator",
      header: "Creator",
      sortKey: "fullName",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 text-[13px] font-bold text-white">
            {row.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{row.fullName}</p>
            <p className="text-[12px] text-white/45">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "accounts",
      header: "Accounts",
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-white/65">
          <Users className="h-3.5 w-3.5" />
          <span>{row.connectedAccountsCount}</span>
        </div>
      ),
    },
    {
      id: "alerts",
      header: "Alerts",
      cell: (row) => (row.unresolvedAlertsCount > 0 ? (
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold">{row.unresolvedAlertsCount}</span>
        </div>
      ) : <span className="text-white/30">—</span>),
    },
    {
      id: "lastActive",
      header: "Last active",
      sortKey: "lastActiveAt",
      cell: (row) => <span className="text-white/50">{new Date(row.lastActiveAt).toLocaleDateString()}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (row.suspendedAt
        ? <Badge variant="destructive">Suspended</Badge>
        : <Badge variant="secondary">Active</Badge>),
    },
  ];

  const confirmCopy = (() => {
    if (!confirm) return null;
    switch (confirm.kind) {
      case "suspend":
        return {
          title: `Suspend ${confirm.creator.fullName}?`,
          description: "The creator will not be able to sign in until reactivated. Scheduled posts continue to run.",
          action: "Suspend",
          onConfirm: () => suspendMutation.mutate(confirm.creator.id),
          isPending: suspendMutation.isPending,
        };
      case "reactivate":
        return {
          title: `Reactivate ${confirm.creator.fullName}?`,
          description: "The creator will regain access immediately.",
          action: "Reactivate",
          onConfirm: () => reactivateMutation.mutate(confirm.creator.id),
          isPending: reactivateMutation.isPending,
        };
      case "delete":
        return {
          title: `Permanently delete ${confirm.creator.fullName}?`,
          description: "This removes the user, all linked accounts, videos, and posts. Cannot be undone.",
          action: "Delete forever",
          onConfirm: () => deleteMutation.mutate(confirm.creator.id),
          isPending: deleteMutation.isPending,
        };
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-white">Content creators</h2>
          {pagination ? (
            <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/50">
              {pagination.total}
            </span>
          ) : null}
        </div>
        <InviteCreatorDialog />
      </div>

      <AdminFilterBar
        search={state.search}
        onSearchChange={(value) => update({ search: value, page: 1 })}
        searchPlaceholder="Search by name or email…"
        filters={[
          {
            id: "status",
            label: "Status",
            value: status === "all" ? "" : status,
            options: STATUS_OPTIONS,
            onChange: (value) => setFilter("status", value || null),
          },
        ]}
        onReset={reset}
      />

      <AdminDataTable
        data={data}
        columns={columns}
        rowId={(row) => row.id}
        isLoading={creatorsQuery.isLoading}
        emptyMessage={creatorsQuery.isError ? "Failed to load creators." : "No creators match your filters."}
        sort={state.sort ? { id: state.sort, order: state.order ?? "desc" } : undefined}
        onSortChange={(next) => update({ sort: next?.id, order: next?.order })}
        pagination={pagination}
        onPageChange={(page) => update({ page })}
        onRowClick={(row) => navigate(`/admin/creators/${row.id}`)}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/admin/creators/${row.id}`)}>
                View profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.suspendedAt ? (
                <DropdownMenuItem onSelect={() => setConfirm({ kind: "reactivate", creator: row })}>
                  <Play className="mr-2 h-4 w-4" /> Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirm({ kind: "suspend", creator: row })}>
                  <Pause className="mr-2 h-4 w-4" /> Suspend
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm({ kind: "delete", creator: row })}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        {confirmCopy ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirmCopy.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmCopy.onConfirm()} disabled={confirmCopy.isPending}>
                {confirmCopy.action}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </div>
  );
}
