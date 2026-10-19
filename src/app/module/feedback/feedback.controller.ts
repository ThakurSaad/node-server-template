import { status } from "../../../util/httpStatus";
import { Request, Response } from "express";
import { FeedbackService } from "./feedback.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";
import { QueryParams } from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";

const postFeedback = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await FeedbackService.postFeedback(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Feedback posted",
    data: result,
  });
});

const getFeedback = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await FeedbackService.getFeedback(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Feedback retrieved",
    data: result,
  });
});

const getMyFeedback = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await FeedbackService.getMyFeedback(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Feedback retrieved",
    data: result,
  });
});

const getAllFeedbacks = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await FeedbackService.getAllFeedbacks(
    req.user,
    req.query as QueryParams,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Feedback retrieved",
    data: result,
  });
});

const updateFeedbackWithReply = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
    }
    const result = await FeedbackService.updateFeedbackWithReply(
      req.user,
      req.body,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Feedback replied",
      data: result,
    });
  },
);

const deleteFeedback = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await FeedbackService.deleteFeedback(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Feedback deleted",
    data: result,
  });
});

const FeedbackController = {
  postFeedback,
  getFeedback,
  getMyFeedback,
  getAllFeedbacks,
  updateFeedbackWithReply,
  deleteFeedback,
};

export { FeedbackController };
