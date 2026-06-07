import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

export type AdminListQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sort?: string;
  order?: "asc" | "desc";
  filters: Record<string, string>;
};

const RESERVED = new Set(["page", "pageSize", "search", "sort", "order"]);

function parse(search: string): AdminListQueryState {
  const params = new URLSearchParams(search);
  const filters: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (!RESERVED.has(key) && value !== "") filters[key] = value;
  }
  return {
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
    pageSize: Math.max(1, Math.min(100, Number(params.get("pageSize") ?? 25) || 25)),
    search: params.get("search") ?? "",
    sort: params.get("sort") ?? undefined,
    order: (params.get("order") as "asc" | "desc" | null) ?? undefined,
    filters,
  };
}

function serialize(state: AdminListQueryState): string {
  const params = new URLSearchParams();
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize !== 25) params.set("pageSize", String(state.pageSize));
  if (state.search) params.set("search", state.search);
  if (state.sort) params.set("sort", state.sort);
  if (state.order) params.set("order", state.order);
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useAdminListQuery(basePath: string) {
  const [, navigate] = useLocation();
  const search = useSearch();

  const state = useMemo(() => parse(search ?? ""), [search]);

  const update = useCallback(
    (patch: Partial<AdminListQueryState> | ((prev: AdminListQueryState) => Partial<AdminListQueryState>)) => {
      const resolved = typeof patch === "function" ? patch(state) : patch;
      const next: AdminListQueryState = {
        ...state,
        ...resolved,
        filters: { ...state.filters, ...(resolved.filters ?? {}) },
      };
      navigate(`${basePath}${serialize(next)}`, { replace: false });
    },
    [navigate, basePath, state],
  );

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      const filters = { ...state.filters };
      if (value === null || value === "") delete filters[key];
      else filters[key] = value;
      update({ filters, page: 1 });
    },
    [state.filters, update],
  );

  const reset = useCallback(() => {
    navigate(basePath, { replace: false });
  }, [navigate, basePath]);

  return { state, update, setFilter, reset };
}
