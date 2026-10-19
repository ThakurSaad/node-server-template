import type { CorsOptions } from "cors";
import config from "../config";
import ApiError from "../error/ApiError";
import { status } from "./httpStatus";

// Exact match against CORS_ORIGINS, no prefix matching. Requests without an
// Origin header (mobile apps, curl, server-to-server) are not subject to CORS.
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.cors_origins.includes(origin))
      return callback(null, true);
    callback(new ApiError(status.FORBIDDEN, "Origin not allowed by CORS"));
  },
  credentials: true,
};

export = corsOptions;
