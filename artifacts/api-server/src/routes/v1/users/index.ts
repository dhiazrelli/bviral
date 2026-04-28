import type { FastifyInstance } from "fastify";
import type {
  CreateUserPayload,
  ListUsersQuery,
  UsersRepository,
} from "../../../repositories/users";

interface UserParams {
  userId: string;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "23505";
}

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.register(async function readScope(readScope) {
    const usersRepository =
      readScope.getDecorator<UsersRepository>("usersRepository");

    readScope.get<{ Querystring: ListUsersQuery }>("/", {
      schema: {
        querystring: { $ref: "usersListQuery#" },
        response: {
          200: { $ref: "usersCollection#" },
          400: { $ref: "errorResponse#" },
          500: { $ref: "errorResponse#" },
        },
      },
    }, async (request) => {
      return usersRepository.list(request.query);
    });

    readScope.get<{ Params: UserParams }>("/:userId", {
      schema: {
        params: { $ref: "userParams#" },
        response: {
          200: { $ref: "user#" },
          400: { $ref: "errorResponse#" },
          404: { $ref: "errorResponse#" },
          500: { $ref: "errorResponse#" },
        },  
      },
    }, async (request, reply) => {
      const user = await usersRepository.findById(request.params.userId);

      if (!user) {
        reply.code(404);
        return {
          statusCode: 404,
          error: "Not Found",
          message: "User was not found.",
        };
      }

      return user;
    });
  });

  fastify.register(async function writeScope(writeScope) {
    const usersRepository =
      writeScope.getDecorator<UsersRepository>("usersRepository");

    writeScope.decorateRequest("adminScope", null);
    writeScope.addHook("preHandler", async (request, reply) => {
      request.adminScope = "users:write";

      if (!writeScope.config.adminToken) {
        if (writeScope.config.nodeEnv === "production") {
          reply.code(500).send({
            statusCode: 500,
            error: "Internal Server Error",
            message: "ADMIN_TOKEN is missing for a protected route.",
          });
        }

        return;
      }

      const adminToken = getHeaderValue(request.headers["x-admin-token"]);

      if (adminToken !== writeScope.config.adminToken) {
        reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "A valid x-admin-token header is required.",
        });
      }
    });

    writeScope.post<{ Body: CreateUserPayload }>("/", {
      schema: {
        body: { $ref: "userCreateBody#" },
        response: {
          201: { $ref: "user#" },
          400: { $ref: "errorResponse#" },
          401: { $ref: "errorResponse#" },
          409: { $ref: "errorResponse#" },
          500: { $ref: "errorResponse#" },
        },
      },
    }, async (request, reply) => {
      try {
        const user = await usersRepository.create(request.body);

        request.log.info(
          {
            adminScope: request.adminScope,
            userId: user.id,
            email: user.email,
          },
          "User created",
        );

        reply.code(201);
        return user;
      } catch (error) {
        if (isUniqueViolation(error)) {
          reply.code(409);
          return {
            statusCode: 409,
            error: "Conflict",
            message: "A user with this email already exists.",
          };
        }

        throw error;
      }
    });
  });
}
