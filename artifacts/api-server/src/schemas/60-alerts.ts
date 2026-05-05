import fp from "fastify-plugin";
import { alertStatusValues, alertTypeValues, platformValues } from "@workspace/db";

const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$";

export default fp(async function alertSchemas(fastify) {
  fastify.addSchema({
    $id: "alert",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: uuidPattern },
      type: { type: "string", enum: [...alertTypeValues] },
      status: { type: "string", enum: [...alertStatusValues] },
      message: { type: "string" },
      platform: { type: "string", enum: [...platformValues] },
      accountId: { anyOf: [{ type: "string", pattern: uuidPattern }, { type: "null" }] },
      postId: { anyOf: [{ type: "string", pattern: uuidPattern }, { type: "null" }] },
      createdAt: { type: "string" },
    },
    required: ["id", "type", "status", "message", "platform", "accountId", "postId", "createdAt"],
  });

  fastify.addSchema({
    $id: "alertsCollection",
    type: "object",
    additionalProperties: false,
    properties: {
      data: {
        type: "array",
        items: { $ref: "alert#" },
      },
    },
    required: ["data"],
  });
}, {
  name: "alert-schemas",
});
