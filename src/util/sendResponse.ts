import type { Response } from "express";
import type { ApiResponse } from "../types/common.types";

const sendResponse = <T>(res: Response, data: ApiResponse<T>): void => {
  const responseData = {
    statusCode: data.statusCode,
    success: data.success,
    ...(data.message != null && { message: data.message }),
    ...(data.meta != null && { meta: data.meta }),
    ...(data.data != null && { data: data.data }),
  };

  res.status(data.statusCode).json(responseData);
};

export = sendResponse;
