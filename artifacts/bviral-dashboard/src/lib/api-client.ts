import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const defaultLocalApiBaseUrl = "http://localhost:3001";

function isBrowserTunnelOrigin() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname;
  return window.location.protocol === "https:"
    && hostname !== "localhost"
    && hostname !== "127.0.0.1";
}

function isLocalApiBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function resolveApiBaseUrl() {
  if (apiBaseUrl && apiBaseUrl.trim()) {
    const configured = apiBaseUrl.trim();
    return isBrowserTunnelOrigin() && isLocalApiBaseUrl(configured)
      ? null
      : configured;
  }

  if (import.meta.env.DEV) {
    if (isBrowserTunnelOrigin()) {
      return null;
    }

    return defaultLocalApiBaseUrl;
  }

  return null;
}

setBaseUrl(resolveApiBaseUrl());

function readSupabaseToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const projectRef = supabaseUrl
    ? new URL(supabaseUrl).hostname.split(".")[0]
    : null;
  const preferredKey = projectRef ? `sb-${projectRef}-auth-token` : null;
  const keys = [
    preferredKey,
    ...Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith("sb-") && key.endsWith("-auth-token"))),
  ].filter((key): key is string => Boolean(key));

  for (const key of keys) {
    const value = window.localStorage.getItem(key);

    if (!value) {
      continue;
    }

    try {
      const parsed = JSON.parse(value) as {
        access_token?: unknown;
        currentSession?: { access_token?: unknown };
      };
      const token = typeof parsed.access_token === "string"
        ? parsed.access_token
        : typeof parsed.currentSession?.access_token === "string"
          ? parsed.currentSession.access_token
          : null;

      if (token) {
        return token;
      }
    } catch {
      continue;
    }
  }

  return null;
}

setAuthTokenGetter(readSupabaseToken);
