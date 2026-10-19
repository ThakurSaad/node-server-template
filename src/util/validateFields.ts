import { status } from "./httpStatus";
import ApiError from "../error/ApiError";

const validateFields = (
  payload: object | null | undefined,
  requiredFields: string[],
): void => {
  if (!payload)
    throw new ApiError(status.BAD_REQUEST, `Request body is required`);

  for (const field of requiredFields) {
    const value = (payload as Record<string, unknown>)[field];
    // false and 0 are valid values; only missing or blank ones are not
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    )
      throw new ApiError(status.BAD_REQUEST, `${field} is required`);
  }
};

export = validateFields;
