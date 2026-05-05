import autoLoad from "@fastify/autoload";
import Fastify, {
  type FastifyError,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNodeEnv } from "./lib/config";
import { loadEnv } from "./lib/load-env";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv();

function getStatusCode(error: FastifyError): number {
  return error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
}

function getErrorName(error: FastifyError, statusCode: number): string {
  return statusCode >= 500 ? "Internal Server Error" : error.name;
}

function getErrorMessage(error: FastifyError, statusCode: number): string {
  return statusCode >= 500 ? "Internal server error" : error.message;
}

function createLoggerOptions(nodeEnv: string): FastifyServerOptions["logger"] {
  if (nodeEnv === "test") {
    return false;
  }

  if (nodeEnv === "production") {
    return {
      level: "info",
      base: {
        service: "bviral-api",
        environment: nodeEnv,
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers.x-admin-token",
          "body.password",
          "*.password",
          "*.secret",
          "*.token",
        ],
        censor: "[REDACTED]",
      },
    };
  }

  return {
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
    redact: {
      paths: ["req.headers.x-admin-token"],
      censor: "[REDACTED]",
    },
  };
}

export interface BuildAppOptions {
  fastify?: FastifyServerOptions;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const nodeEnv = resolveNodeEnv(process.env.NODE_ENV);
  const app = Fastify({
    logger: options.logger ?? createLoggerOptions(nodeEnv),
    disableRequestLogging: true,
    requestIdHeader: "x-request-id",
    genReqId(request) {
      const incomingId = request.headers["x-request-id"];
      return typeof incomingId === "string" && incomingId.length > 0
        ? incomingId
        : randomUUID();
    },
    ajv: {
      customOptions: {
        removeAdditional: true,
        useDefaults: true,
        coerceTypes: true,
      },
    },
    ...options.fastify,
  });

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as FastifyError & {
      validation?: unknown;
    };

    if (fastifyError.validation) {
      request.log.warn(
        {
          validation: fastifyError.validation,
          method: request.method,
          url: request.url,
        },
        "Request validation failed",
      );

      reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Request validation failed",
      });
      return;
    }

    request.log.error({ err: fastifyError }, "Unhandled request error");
    const statusCode = getStatusCode(fastifyError);

    reply.code(statusCode).send({
      statusCode,
      error: getErrorName(fastifyError, statusCode),
      message: getErrorMessage(fastifyError, statusCode),
    });
  });

  await app.register(autoLoad, {
    dir: join(__dirname, "schemas"),
  });

  await app.register(autoLoad, {
    dir: join(__dirname, "plugins"),
  });

  await app.register(autoLoad, {
    dir: join(__dirname, "routes"),
    options: {
      prefix: "/api",
    },
  });

  return app;
}

export function getAppLogger(app: FastifyInstance): FastifyBaseLogger {
  return app.log;
}
