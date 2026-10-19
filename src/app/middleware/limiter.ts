import rateLimit from "express-rate-limit";
import sendResponse from "../../util/sendResponse";
import { Request, Response } from "express";

interface LimiterOptions {
  windowMs?: number;
  limit?: number;
}

const createLimiter = ({
  windowMs = 60 * 60 * 1000,
  limit = 10,
}: LimiterOptions = {}) =>
  rateLimit({
    windowMs,
    limit,
    statusCode: 429,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: async (req: Request, res: Response) =>
      sendResponse(res, {
        statusCode: 429,
        success: false,
        message: "Too many requests please try again later",
      }),
  });

// Default limiter kept for existing consumers (e.g. /auth/login)
const limiter = createLimiter();

export { createLimiter };
export default limiter;
