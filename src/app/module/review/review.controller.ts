import { status } from "../../../util/httpStatus";
import { Request, Response } from "express";
import { ReviewService } from "./review.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";
import { QueryParams } from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";

const postReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.postReview();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review posted",
    data: result,
  });
});

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ReviewService.getAllReviews(
    req.user,
    req.query as QueryParams,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review retrieved",
    data: result,
  });
});

const getReview = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ReviewService.getReview(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review retrieved",
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ReviewService.updateReview(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review updated",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ReviewService.deleteReview(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review deleted",
    data: result,
  });
});

const ReviewController = {
  postReview,
  getAllReviews,
  getReview,
  updateReview,
  deleteReview,
};

export { ReviewController };
