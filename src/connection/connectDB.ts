import mongoose from "mongoose";
import config from "../config";
import { errorLogger } from "../util/logger";

const connectDB = async () => {
  try {
    await mongoose.connect(config.database_url);
    // server.ts logs the success line once listen() also succeeds
  } catch (err) {
    errorLogger.error("DB connection error", err);
    process.exit(1);
  }
};

export = connectDB;
