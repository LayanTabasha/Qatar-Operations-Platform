import { app } from "./app.js";
import { closeDatabasePool, testDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

let server;
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Shutting down server");

  if (server) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.closeAllConnections?.();
        resolve();
      }, 5000);

      server.close((err) => {
        clearTimeout(timeout);
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

  server.on("error", async (err) => {
    logger.error({ err, port: env.PORT }, "Server listener error");
    await closeDatabasePool();
    process.exit(1);
  });
}

function exitAfterShutdown(signal) {
  shutdown(signal)
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Graceful shutdown failed");
      process.exit(1);
    });
}

process.on("SIGTERM", () => exitAfterShutdown("SIGTERM"));
process.on("SIGINT", () => exitAfterShutdown("SIGINT"));

process.once("SIGUSR2", () => {
  shutdown("SIGUSR2")
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
