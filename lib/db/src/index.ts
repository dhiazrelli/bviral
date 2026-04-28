import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const defaultPoolConfig: Pick<
  PoolConfig,
  "idleTimeoutMillis" | "connectionTimeoutMillis"
> = {
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

export function createPool(
  connectionString: string,
  overrides: Omit<PoolConfig, "connectionString"> = {},
) {
  return new Pool({
    ...defaultPoolConfig,
    ...overrides,
    connectionString,
  });
}

export function createDatabase(pool: Pool): Database {
  return drizzle(pool, { schema });
}

export { schema };
export * from "./schema";
