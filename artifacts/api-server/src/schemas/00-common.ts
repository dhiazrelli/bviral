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

  fastify.addSchema({
    $id: "authMeResponse",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      email: { type: "string" },
      role: { type: "string", enum: ["admin", "team"] },
      jwtRole: { type: "string" },
      appMetadata: { type: "object", additionalProperties: true },
      userMetadata: { type: "object", additionalProperties: true },
    },
    required: ["id", "role", "appMetadata", "userMetadata"],
  });
}, {
  name: "common-schemas",
});
