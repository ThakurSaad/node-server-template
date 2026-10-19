import mongoose from "mongoose";
import { logger, errorLogger } from "./util/logger";
import connectDB from "./connection/connectDB";
import config from "./config";
import { mainServer, io } from "./connection/socket";
import { startJobs, stopJobs } from "./jobs";

const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

let isShuttingDown = false;

const shutdown = async (exitCode: number, reason: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Shutting down (${reason})...`);

  // Hard-kill fallback in case a connection refuses to close
  const forceExit = setTimeout(() => {
    errorLogger.error("Forced shutdown after timeout");
    process.exit(exitCode);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    stopJobs();
    io.close();
    await new Promise<void>((resolve) => mainServer.close(() => resolve()));
    await mongoose.disconnect();
    logger.info("Shutdown complete");
  } catch (error) {
    errorLogger.error("Error during shutdown:", error);
  } finally {
    process.exit(exitCode);
  }
};

process.on("unhandledRejection", (error) => {
  errorLogger.error("Unhandled Rejection:", error);
  shutdown(1, "unhandledRejection");
});

process.on("uncaughtException", (error) => {
  errorLogger.error("Uncaught Exception:", error);
  shutdown(1, "uncaughtException");
});

process.on("SIGTERM", () => shutdown(0, "SIGTERM"));
process.on("SIGINT", () => shutdown(0, "SIGINT"));

async function main() {
  try {
    await connectDB();
    logger.info(`DB Connected Successfully at ${new Date().toLocaleString()}`);

    mainServer.listen(Number(config.port), config.base_url, () => {
      logger.info(`App listening on http://${config.base_url}:${config.port}`);
    });

    startJobs();
  } catch (err) {
    errorLogger.error("Main Function Error:", err);
    process.exit(1);
  }
}

main();
