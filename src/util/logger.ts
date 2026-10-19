import path from "path";
import { createLogger, format, transports } from "winston";
import { TransformableInfo } from "logform";
import DailyRotateFile from "winston-daily-rotate-file";

const { combine, timestamp, label, printf } = format;

interface LogInfo extends TransformableInfo {
  label?: string;
  timestamp?: string;
  stack?: string;
}

// Custom log format
export const myFormat = printf((info: LogInfo) => {
  const { level, message, label, timestamp, stack } = info;
  const date = new Date(timestamp ?? Date.now());
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  // winston copies an Error argument's stack onto info.stack
  const trace = stack ? `\n${stack}` : "";

  return `${date.toDateString()} ${h}:${m}:${s} [${label}] ${level}: ${message}${trace}`;
});

const logDir = path.join(process.cwd(), "logs", "winston");

// Logger for general information
export const logger = createLogger({
  level: "info",
  format: combine(label({ label: "Mount Fuji" }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      level: "info",
      filename: path.join(logDir, "successes", "um-%DATE%-success.log"),
      datePattern: "YYYY-MM-DD-HH",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

// Logger for errors
export const errorLogger = createLogger({
  level: "error",
  format: combine(label({ label: "Mount Fuji" }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      level: "error",
      filename: path.join(logDir, "errors", "um-%DATE%-error.log"),
      datePattern: "YYYY-MM-DD-HH",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});
