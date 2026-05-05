import fp from "fastify-plugin";
import { platformValues } from "@workspace/db";

const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$";

export default fp(async function accountSchemas(fastify) {
  fastify.addSchema({
    $id: "account",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: uuidPattern },
      platform: { type: "string", enum: [...platformValues] },
      accountName: { type: "string", minLength: 1, maxLength: 255 },
      tokenExpiry: { anyOf: [{ type: "string" }, { type: "null" }] },
      userId: { type: "string", pattern: uuidPattern },
      metadata: { type: "object", additionalProperties: true },
      createdAt: { type: "string" },
    },
    required: [
      "id",
      "platform",
      "accountName",
      "tokenExpiry",
      "userId",
      "metadata",
      "createdAt",
    ],
  });

  fastify.addSchema({
    $id: "accountsCollection",
    type: "object",
    additionalProperties: false,
    properties: {
      data: {
        type: "array",
        items: { $ref: "account#" },
      },
    },
    required: ["data"],
  });
}, {
  name: "account-schemas",
});
