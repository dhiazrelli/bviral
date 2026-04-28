import fp from "fastify-plugin";

export default fp(async function commonSchemas(fastify) {
  fastify.addSchema({
    $id: "errorResponse",
    type: "object",
    additionalProperties: false,
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
    required: ["statusCode", "error", "message"],
  });

  fastify.addSchema({
    $id: "healthStatus",
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["ok"],
      },
    },
    required: ["status"],
  });
}, {
  name: "common-schemas",
});
