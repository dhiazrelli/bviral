import cors from "@fastify/cors";
import fp from "fastify-plugin";

export default fp(async function corsPlugin(fastify) {
  await fastify.register(cors, {
    origin(origin, callback) {
      if (!origin || fastify.config.corsOrigins.length === 0) {
        callback(null, true);
        return;
      }

      callback(null, fastify.config.corsOrigins.includes(origin));
    },
  });
}, {
  name: "cors-plugin",
  dependencies: ["app-config"],
});
