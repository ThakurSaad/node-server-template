import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import deleteUploadedFiles from "../../util/deleteUploadedFiles";

// Validates body/query/params against a zod schema before the controller
// runs. Parsed (and coerced) values are written back to req.body so
// services always receive clean data. ZodErrors are formatted by
// globalErrorHandler via handleZodError.
//
// req.query is a read-only getter in Express 5, so query schemas only
// *check* values — only body is written back.
const validateRequest =
  (schema: ZodType) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Express 5 leaves req.body undefined when no body is sent; validate a
      // body-less request like an empty one instead of rejecting it outright.
      const parsed = await schema.parseAsync({
        body: req.body ?? {},
        query: req.query,
        params: req.params,
      });

      if (parsed && typeof parsed === "object" && "body" in parsed) {
        req.body = (parsed as { body: unknown }).body;
      }

      next();
    } catch (error) {
      // Multipart routes validate after multer has already stored the file
      deleteUploadedFiles(req.uploadedFiles);
      next(error);
    }
  };

export = validateRequest;
