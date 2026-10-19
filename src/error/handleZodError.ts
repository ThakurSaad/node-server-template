import { ZodError } from "zod";

const handleZodError = (error: ZodError) => {
  const errorMessages = error.issues.map((issue) => ({
    // Drop the leading "body"/"query"/"params" segment for readable paths
    path: issue.path.slice(1).join(".") || String(issue.path[0] ?? ""),
    message: issue.message,
  }));

  return {
    statusCode: 400,
    message: "Validation error",
    errorMessages,
  };
};

export = handleZodError;
