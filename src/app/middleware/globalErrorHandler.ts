import { NextFunction, Request, Response } from "express";
import mongoose, { Error as mongooseError } from "mongoose";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { MulterError } from "multer";
import { ZodError } from "zod";
import config from "../../config";
import handleValidationError from "../../error/handleValidationError";
import handleCastError from "../../error/handleCastError";
import ApiError from "../../error/ApiError";
import handleMulterError from "../../error/handleMulterError";
import handleZodError from "../../error/handleZodError";
import createErrorMessage from "../../util/createErrorMessage";
import { errorLogger } from "../../util/logger";

// Type definitions for error handling
interface ErrorMessage {
  statusCode: number;
  message: string;
  errorMessages: Array<{ path: string; message: string }>;
}

interface ErrorResponse extends ErrorMessage {
  success: boolean;
  stack?: string;
}

interface MongooseDuplicateError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

// Type guard for Mongoose errors
const isMongooseError = (error: unknown): error is mongooseError => {
  return error instanceof mongooseError;
};

// Type guard for duplicate key errors
const isDuplicateKeyError = (
  error: unknown,
): error is MongooseDuplicateError => {
  return (
    error instanceof Error &&
    (error as MongooseDuplicateError).code === 11000 &&
    (error as MongooseDuplicateError).keyValue !== undefined
  );
};

// Error handler type
type ErrorHandler = () => ErrorMessage;

const globalErrorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const logError = config.env === "development" ? console.log : console.error;
  logError("❌ globalErrorHandler", error);

  if (error instanceof Error) {
    errorLogger.error(error.message);
  }

  // Default values
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorMessages: Array<{ path: string; message: string }> =
    createErrorMessage(message);

  // Safely extract error properties
  if (error instanceof Error) {
    message = error.message || message;
    if ("statusCode" in error && typeof error.statusCode === "number") {
      statusCode = error.statusCode;
    }
  }

  // Error type handlers
  const errorHandlers: Record<string, ErrorHandler> = {
    ValidationError: () => {
      const {
        statusCode: code,
        message,
        errorMessages: messages,
      } = handleValidationError(error as mongooseError.ValidationError);
      return { statusCode: code || 400, message, errorMessages: messages };
    },
    JsonWebTokenError: () => ({
      statusCode: 401,
      message: "Invalid token",
      errorMessages: createErrorMessage(
        error instanceof Error ? error.message : "Invalid token",
      ),
    }),
    TokenExpiredError: () => ({
      statusCode: 401,
      message: "Token has expired",
      errorMessages: createErrorMessage(
        error instanceof Error ? error.message : "Token expired",
      ),
    }),
    CastError: () => {
      const {
        statusCode: code,
        message,
        errorMessages: messages,
      } = handleCastError(error as mongoose.Error.CastError);
      return { statusCode: code || 400, message, errorMessages: messages };
    },
    ApiError: () => ({
      statusCode: error instanceof ApiError ? error.statusCode : 500,
      message: error instanceof Error ? error.message : "API Error",
      errorMessages: createErrorMessage(
        error instanceof Error ? error.message : "API Error",
      ),
    }),
    DuplicateKeyError: () => {
      if (!isDuplicateKeyError(error)) {
        return {
          statusCode: 409,
          message: "Duplicate key error",
          errorMessages: createErrorMessage("Duplicate key error"),
        };
      }
      const field = Object.keys(error.keyValue || {})[0] || "field";
      return {
        statusCode: 409,
        message: `${field} must be unique`,
        errorMessages: createErrorMessage(`${field} must be unique`, field),
      };
    },
    TypeError: () => ({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Type Error",
      errorMessages: createErrorMessage(
        error instanceof Error ? error.message : "Type Error",
      ),
    }),
    mongooseError: () => ({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Mongoose Error",
      errorMessages: createErrorMessage(
        error instanceof Error ? error.message : "Mongoose Error",
      ),
    }),
    MulterError: () => handleMulterError(error as MulterError),
    ZodError: () => handleZodError(error as ZodError),
  };

  // Determine the specific error handler
  let errorType: ErrorHandler | undefined;

  if (error instanceof Error && error.name in errorHandlers) {
    errorType = errorHandlers[error.name];
  } else if (error instanceof JsonWebTokenError) {
    errorType = errorHandlers.JsonWebTokenError;
  } else if (error instanceof TokenExpiredError) {
    errorType = errorHandlers.TokenExpiredError;
  } else if (error instanceof ApiError) {
    errorType = errorHandlers.ApiError;
  } else if (isDuplicateKeyError(error)) {
    errorType = errorHandlers.DuplicateKeyError;
  } else if (error instanceof TypeError) {
    errorType = errorHandlers.TypeError;
  } else if (isMongooseError(error)) {
    errorType = errorHandlers.mongooseError;
  } else if (error instanceof MulterError) {
    errorType = errorHandlers.MulterError;
  } else if (error instanceof ZodError) {
    errorType = errorHandlers.ZodError;
  }

  if (errorType) {
    ({ statusCode, message, errorMessages } = errorType());
  }

  // Ensure valid HTTP status code
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  // Response
  const response: ErrorResponse = {
    success: false,
    statusCode,
    message,
    errorMessages,
    stack:
      config.env !== "production" && error instanceof Error
        ? error.stack
        : undefined,
  };

  res.status(statusCode).json(response);
};

export = globalErrorHandler;
