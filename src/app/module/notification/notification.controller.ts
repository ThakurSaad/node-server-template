import { status } from "../../../util/httpStatus";
import { NotificationService } from "./notification.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";
import type { Request, Response } from "express";
import { QueryParams } from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";

const getNotification = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await NotificationService.getNotification(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification retrieved",
    data: result,
  });
});

const getAllNotifications = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await NotificationService.getAllNotifications(
    req.user,
    req.query as QueryParams,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notifications retrieved",
    meta: result.meta,
    data: result.notifications,
  });
});

const updateAsReadUnread = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await NotificationService.updateAsReadUnread(
    req.user,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification updated",
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await NotificationService.deleteNotification(
    req.user,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification deleted",
    data: result,
  });
});

const NotificationController = {
  getNotification,
  getAllNotifications,
  updateAsReadUnread,
  deleteNotification,
};

export { NotificationController };
