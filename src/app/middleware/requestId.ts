import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

// Attaches a unique id to every request for log correlation.
// The id is echoed back in the X-Request-Id response header.
const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};

export = requestId;
