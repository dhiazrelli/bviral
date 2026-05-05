import { defineConfig } from "drizzle-kit";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnv() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(moduleDir, ".env"),
    resolve(moduleDir, "..", "..", ".env"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = stripWrappingQuotes(
        line.slice(separatorIndex + 1).trim(),
      );
    }

    return;
  }
}

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

let databaseUrl: URL;

try {
  databaseUrl = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error(
    "DATABASE_URL must be a valid PostgreSQL connection string.",
  );
}

const isSupabaseDirectHost =
  databaseUrl.hostname.startsWith("db.")
  && databaseUrl.hostname.endsWith(".supabase.co")
  && databaseUrl.port === "5432";

if (isSupabaseDirectHost) {
  throw new Error(
    "DATABASE_URL is using Supabase's direct host. On local IPv4-only networks this often fails because the direct host is IPv6-first. Use the Session pooler connection string from the Supabase dashboard Connect panel instead.",
  );
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
