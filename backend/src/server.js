import { app } from "./app.js";
import { closeDatabasePool, testDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

let server;

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down server");

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  await closeDatabasePool();
  logger.info("Shutdown complete");
}

async function startServer() {
  await testDatabaseConnection();

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Qatar Operations API listening");
  });
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM")
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Graceful shutdown failed");
      process.exit(1);
    });
});

process.on("SIGINT", () => {
  shutdown("SIGINT")
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Graceful shutdown failed");
      process.exit(1);
    });
});

startServer().catch(async (err) => {
  logger.error({ err }, "Failed to start Qatar Operations API");
  await closeDatabasePool();
  process.exit(1);
});
