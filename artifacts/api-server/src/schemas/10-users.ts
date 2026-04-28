import fp from "fastify-plugin";
import { userRoleValues } from "@workspace/db";

const emailPattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
const uuidPattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export default fp(async function userSchemas(fastify) {
  fastify.addSchema({
    $id: "user",
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: uuidPattern },
      email: { type: "string", pattern: emailPattern, maxLength: 255 },
      fullName: { type: "string", minLength: 1, maxLength: 120 },
      role: { type: "string", enum: [...userRoleValues] },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "email", "fullName", "role", "createdAt", "updatedAt"],
  });

  fastify.addSchema({
    $id: "userCreateBody",
    type: "object",
    additionalProperties: false,
    properties: {
      email: { type: "string", pattern: emailPattern, maxLength: 255 },
      fullName: { type: "string", minLength: 1, maxLength: 120 },
      role: { type: "string", enum: [...userRoleValues] },
    },
    required: ["email", "fullName", "role"],
  });

  fastify.addSchema({
    $id: "usersListQuery",
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      search: { type: "string", minLength: 1, maxLength: 120 },
    },
  });

  fastify.addSchema({
    $id: "userParams",
    type: "object",
    additionalProperties: false,
    properties: {
      userId: { type: "string", pattern: uuidPattern },
    },
    required: ["userId"],
  });

  fastify.addSchema({
    $id: "usersCollection",
    type: "object",
    additionalProperties: false,
    properties: {
      data: {
        type: "array",
        items: { $ref: "user#" },
      },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
        },
        required: ["page", "limit", "total"],
      },
    },
    required: ["data", "meta"],
  });
}, {
  name: "user-schemas",
});
