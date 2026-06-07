import { type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AdminDataColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  sortKey?: string;
};

export type AdminDataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminDataTableProps<T> = {
  data: T[];
  columns: AdminDataColumn<T>[];
  rowId: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  sort?: { id: string; order: "asc" | "desc" };
  onSortChange?: (next: { id: string; order: "asc" | "desc" } | undefined) => void;
  pagination?: AdminDataTablePagination;
  onPageChange?: (page: number) => void;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
};

export function AdminDataTable<T>({
  data,
  columns,
  rowId,
  isLoading,
  emptyMessage = "No results.",
  selectable,
  selectedIds = [],
  onSelectedIdsChange,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  rowActions,
  onRowClick,
}: AdminDataTableProps<T>) {
  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(rowId(row)));
  const someSelected = !allSelected && data.some((row) => selectedIds.includes(rowId(row)));

  function toggleAll() {
    if (!onSelectedIdsChange) return;
    if (allSelected) {
      const visibleIds = new Set(data.map(rowId));
      onSelectedIdsChange(selectedIds.filter((id) => !visibleIds.has(id)));
    } else {
      const merged = new Set(selectedIds);
      for (const row of data) merged.add(rowId(row));
      onSelectedIdsChange(Array.from(merged));
    }
  }

  function toggleRow(id: string) {
    if (!onSelectedIdsChange) return;
    if (selectedIds.includes(id)) onSelectedIdsChange(selectedIds.filter((existing) => existing !== id));
    else onSelectedIdsChange([...selectedIds, id]);
  }

  function handleHeaderClick(column: AdminDataColumn<T>) {
    if (!onSortChange || !column.sortKey) return;
    if (sort?.id !== column.sortKey) {
      onSortChange({ id: column.sortKey, order: "desc" });
      return;
    }
    if (sort.order === "desc") onSortChange({ id: column.sortKey, order: "asc" });
    else onSortChange(undefined);
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all rows"
                />
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const isSorted = sort?.id === column.sortKey;
              const Icon = !column.sortKey
                ? null
                : isSorted
                  ? sort?.order === "asc" ? ArrowUp : ArrowDown
                  : ArrowUpDown;
              return (
                <TableHead
                  key={column.id}
                  className={cn(
                    column.className,
                    column.sortKey && onSortChange && "cursor-pointer select-none",
                  )}
                  onClick={() => handleHeaderClick(column)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {column.header}
                    {Icon ? <Icon className="h-3.5 w-3.5 opacity-60" /> : null}
                  </span>
                </TableHead>
              );
            })}
            {rowActions ? <TableHead className="w-10 text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {selectable ? <TableCell><Skeleton className="h-4 w-4" /></TableCell> : null}
                {columns.map((column) => (
                  <TableCell key={column.id}><Skeleton className="h-4 w-24" /></TableCell>
                ))}
                {rowActions ? <TableCell><Skeleton className="h-7 w-7" /></TableCell> : null}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                className="h-32 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => {
              const id = rowId(row);
              const checked = selectedIds.includes(id);
              return (
                <TableRow
                  key={id}
                  data-state={checked ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable ? (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      {rowActions(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {pagination && pagination.total > 0 ? (
        <div className="flex items-center justify-between border-t border-white/6 px-4 py-3 text-xs text-muted-foreground">
          <span>
            {`Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total.toLocaleString()} total`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
