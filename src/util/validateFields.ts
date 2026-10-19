import { status } from "./httpStatus";
import ApiError from "../error/ApiError";

const validateFields = (
  payload: Record<string, any> | null | undefined,
  requiredFields: string[],
): void => {
  if (!payload)
    throw new ApiError(status.BAD_REQUEST, `Request body is required`);

  for (const field of requiredFields)
    if (!payload[field])
      throw new ApiError(status.BAD_REQUEST, `${field} is required`);
};

export = validateFields;
