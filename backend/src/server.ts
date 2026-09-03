import { createApp } from "./app";
import { env } from "./config/env";
import { createLogger } from "./config/logger";
import { databasePool } from "./database/pool";

const logger = createLogger(env);
const app = createApp();
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, environment: env.NODE_ENV }, "Clinic API started"));

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down clinic API");
  server.close(async () => {
    await databasePool.end();
    logger.info("Database pool closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  void shutdown("unhandledRejection");
});

