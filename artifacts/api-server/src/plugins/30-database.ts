import { createDatabase, createPool } from "@workspace/db";
import fp from "fastify-plugin";

export default fp(async function databasePlugin(fastify) {
  const pool = createPool(fastify.config.databaseUrl, {
    max: fastify.config.dbPoolMax,
  });

  fastify.decorate("pgPool", pool);
  fastify.decorate("db", createDatabase(pool));

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}, {
  name: "database-plugin",
  dependencies: ["app-config"],
});
