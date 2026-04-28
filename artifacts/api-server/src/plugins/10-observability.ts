import fp from "fastify-plugin";

export default fp(async function observabilityPlugin(fastify) {
  fastify.addHook("onRequest", async (request) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request",
    );
  });

  fastify.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed",
    );
  });
}, {
  name: "observability-plugin",
});
