import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

// Validates body/query/params against a zod schema before the controller
// runs. Parsed (and coerced) values are written back to req.body so
// services always receive clean data. ZodErrors are formatted by
// globalErrorHandler via handleZodError.
const validateRequest =
  (schema: ZodType) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed && typeof parsed === "object" && "body" in parsed) {
        req.body = (parsed as { body: unknown }).body;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export = validateRequest;
