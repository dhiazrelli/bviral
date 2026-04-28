import type { Database } from "@workspace/db";
import type { Pool } from "pg";
import type { AppConfig } from "../lib/config";
import type { UsersRepository } from "../repositories/users";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: Database;
    pgPool: Pool;
    usersRepository: UsersRepository;
  }

  interface FastifyRequest {
    adminScope: "users:write" | null;
  }
}
