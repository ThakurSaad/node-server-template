import cron, { ScheduledTask } from "node-cron";
import { logger } from "../util/logger";
import { cleanupExpiredOtpFields } from "./otpCleanup.job";

const tasks: ScheduledTask[] = [];

// Called from server.ts after the DB connection is established, so that
// importing app modules (e.g. in tests) never starts background jobs.
const startJobs = () => {
  tasks.push(
    cron.schedule("* * * * *", async () => {
      try {
        await Promise.all([
          cleanupExpiredOtpFields("activation"),
          cleanupExpiredOtpFields("verification"),
        ]);
      } catch (error) {
        logger.error("Error removing expired code:", error);
      }
    }),
  );

  logger.info("Background jobs started");
};

const stopJobs = () => {
  tasks.forEach((task) => task.stop());
  tasks.length = 0;
};

export { startJobs, stopJobs };
