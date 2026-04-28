import { buildApp } from "./app";

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

async function startServer() {
  const app = await buildApp();

  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      app.log.info({ signal }, "Received shutdown signal");

      try {
        await app.close();
        process.exit(0);
      } catch (error) {
        app.log.error({ err: error, signal }, "Graceful shutdown failed");
        process.exit(1);
      }
    });
  }

  await app.listen({
    host: app.config.host,
    port: app.config.port,
  });

  app.log.info(
    {
      host: app.config.host,
      port: app.config.port,
      environment: app.config.nodeEnv,
    },
    "API server listening",
  );
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
