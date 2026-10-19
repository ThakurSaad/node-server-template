import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import config from "./config";
import globalErrorHandler from "./app/middleware/globalErrorHandler";
import requestId from "./app/middleware/requestId";
import routes from "./app/routes";
import NotFoundHandler from "./error/NotFoundHandler";
import corsOptions from "./util/corsOptions";
import { logger } from "./util/logger";

const app = express();

// Behind a reverse proxy (nginx etc.) the client IP comes from X-Forwarded-For;
// required for express-rate-limit to key per client instead of per proxy
app.set("trust proxy", 1);

// "simple" prevents bracketed params (?a[$ne]=x) from parsing into nested
// objects, closing off NoSQL operator injection at the transport layer
app.set("query parser", "simple");

app.use(requestId);
app.use(
  helmet({
    // Uploads are consumed cross-origin by frontend apps
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Swagger UI (/docs, non-production) relies on inline scripts the
    // default CSP blocks; production keeps the full policy
    contentSecurityPolicy: config.env === "production" ? undefined : false,
  }),
);
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  morgan(":method :url :status :response-time ms - :res[x-request-id]", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);
app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "1d",
    immutable: true,
    index: false,
    dotfiles: "deny",
  }),
);

app.get("/", async (req: Request, res: Response) => {
  res.json("Welcome to Mount Fuji");
});

app.get("/health", async (req: Request, res: Response) => {
  const dbUp = mongoose.connection.readyState === 1;

  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? "ok" : "degraded",
    uptime: process.uptime(),
    db: dbUp ? "up" : "down",
  });
});

// Interactive API docs, outside production only
if (config.env !== "production") {
  const openapiPath = path.join(process.cwd(), "docs", "openapi.yaml");
  if (fs.existsSync(openapiPath)) {
    const openapiDoc = YAML.parse(fs.readFileSync(openapiPath, "utf8"));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
  }
}

app.use("/", routes);

app.use(NotFoundHandler.handle);
app.use(globalErrorHandler);

export = app;
