import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(moduleDir, "..", "..");
const workspaceRoot = resolve(packageDir, "..", "..");

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(contents: string) {
  for (const rawLine of contents.split(/\r?\n/u)) {
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

    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    process.env[key] = value;
  }
}

export function loadEnv() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(packageDir, ".env"),
    resolve(workspaceRoot, ".env"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    parseEnvFile(readFileSync(filePath, "utf8"));
    return filePath;
  }

  return null;
}
