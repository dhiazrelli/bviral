import fp from "fastify-plugin";
import { resolveConfig } from "../lib/config";

export default fp(async function configPlugin(fastify) {
  fastify.decorate("config", resolveConfig());
}, {
  name: "app-config",
});
