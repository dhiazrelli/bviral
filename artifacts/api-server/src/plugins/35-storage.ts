import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fp from "fastify-plugin";

export default fp(async function storagePlugin(fastify) {
  const serviceRoleKey = fastify.config.supabaseServiceRoleKey;

  fastify.decorate("supabaseAdmin", serviceRoleKey
    ? createClient(fastify.config.supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    : null);
}, {
  name: "storage-plugin",
  dependencies: ["app-config"],
});

declare module "fastify" {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient | null;
  }
}
