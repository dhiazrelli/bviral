import { type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

type AdminFilterBarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    id: string;
    label: string;
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
  }>;
  dateRange?: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
  };
  extra?: ReactNode;
  onReset?: () => void;
};

export function AdminFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  dateRange,
  extra,
  onReset,
}: AdminFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      {onSearchChange ? (
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={search ?? ""}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}

      {filters.map((filter) => (
        <div key={filter.id} className="min-w-[10rem]">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            {filter.label}
          </p>
          <Select value={filter.value || "__all__"} onValueChange={(v) => filter.onChange(v === "__all__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {dateRange ? (
        <div className="flex items-end gap-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">From</p>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(event) => dateRange.onChange(event.target.value, dateRange.to)}
              className="w-[10rem]"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">To</p>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(event) => dateRange.onChange(dateRange.from, event.target.value)}
              className="w-[10rem]"
            />
          </div>
        </div>
      ) : null}

      {extra}

      {onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
          <X className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
      ) : null}
    </div>
  );
}
