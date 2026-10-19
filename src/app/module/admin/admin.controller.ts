import { status } from "../../../util/httpStatus";
import sendResponse from "../../../util/sendResponse";
import { AdminService } from "./admin.service";
import catchAsync from "../../../util/catchAsync";
import { Request, Response } from "express";
import ApiError from "../../../error/ApiError";

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.updateProfile(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const getProfile = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await AdminService.getProfile(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin retrieved successfully",
    data: result,
  });
});

const deleteMyAccount = catchAsync(async (req: Request, res: Response) => {
  await AdminService.deleteMyAccount(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Account deleted!",
  });
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.createAdmin(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Admin created successfully",
    data: result,
  });
});

const AdminController = {
  createAdmin,
  updateProfile,
  getProfile,
  deleteMyAccount,
};

export { AdminController };
