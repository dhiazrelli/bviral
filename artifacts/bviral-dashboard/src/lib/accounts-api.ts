// Lightweight wrapper for the PATCH /api/v1/accounts/:id route.
//
// The bulk of the API surface is consumed via the orval-generated
// `@workspace/api-client-react` package. The PATCH endpoint was added after
// the most recent codegen run, so we hand-roll it here so the dashboard
// doesn't need a regen step before users can rename their accounts.
//
// Auth token resolution mirrors `lib/api-client.ts`: pick up the Supabase
// access token from localStorage so calls go out as the current user.

import type { Account } from "@workspace/api-client-react";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const defaultLocalApiBaseUrl = "http://localhost:3001";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

function getApiBaseUrl() {
  if (configuredApiBaseUrl && configuredApiBaseUrl.trim()) {
    return configuredApiBaseUrl.trim();
  }

  if (import.meta.env.DEV) {
    return defaultLocalApiBaseUrl;
  }

  return "";
}

function getProjectRef() {
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).hostname.split(".")[0];
  } catch {
    return null;
  }
}

function readSupabaseToken() {
  if (typeof window === "undefined") return null;
  const projectRef = getProjectRef();
  const preferredKey = projectRef ? `sb-${projectRef}-auth-token` : null;
  const otherKeys = Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  ).filter((key): key is string => Boolean(key && key.startsWith("sb-") && key.endsWith("-auth-token")));

  const keys = [preferredKey, ...otherKeys].filter(
    (key): key is string => Boolean(key),
  );

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as {
        access_token?: unknown;
        currentSession?: { access_token?: unknown };
      };
      const token =
        typeof parsed.access_token === "string"
          ? parsed.access_token
          : typeof parsed.currentSession?.access_token === "string"
          ? parsed.currentSession.access_token
          : null;
      if (token) return token;
    } catch {
      continue;
    }
  }

  return null;
}

function joinUrl(path: string) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return path;
  return `${apiBaseUrl.replace(/\/+$/, "")}${path}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  } catch {
    // fall through
  }
  return `HTTP ${response.status} ${response.statusText}`.trim();
}

export interface UpdateAccountInput {
  accountName?: string;
  metadata?: Record<string, unknown>;
}

export async function updateAccountById(
  id: string,
  input: UpdateAccountInput,
): Promise<Account> {
  const token = readSupabaseToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(joinUrl(`/api/v1/accounts/${id}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as Account;
}
