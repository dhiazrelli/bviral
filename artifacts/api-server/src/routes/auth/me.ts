import type { FastifyInstance } from "fastify";

export default async function authMeRoutes(fastify: FastifyInstance) {
  fastify.get("/me", {
    schema: {
      response: {
        200: { $ref: "authMeResponse#" },
        401: { $ref: "errorResponse#" },
      },
    },
  }, async (request) => {
    const user = request.currentUser;

    if (!user) {
      throw new Error("Authenticated user was not attached to the request.");
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      jwtRole: user.jwtRole,
      appMetadata: user.appMetadata,
      userMetadata: user.userMetadata,
    };
  });
}
