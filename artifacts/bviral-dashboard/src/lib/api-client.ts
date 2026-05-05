import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

setBaseUrl(apiBaseUrl && apiBaseUrl.trim() ? apiBaseUrl : null);

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
