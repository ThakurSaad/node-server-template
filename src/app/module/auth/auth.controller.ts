import { status } from "../../../util/httpStatus";
import { AuthService } from "./auth.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";
import config from "../../../config";
import { Request, Response } from "express";
import ApiError from "../../../error/ApiError";

const registrationAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.registrationAccount(req.body);

  const isSuccess =
    result.message === "Account created successfully. Please check your email";

  sendResponse(res, {
    statusCode: isSuccess ? 200 : 400,
    success: isSuccess,
    message: result.message || "Something went wrong",
    data: result,
  });
});

const resendActivationCode = catchAsync(async (req: Request, res: Response) => {
  await AuthService.resendActivationCode(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Resent successfully",
  });
});

const activateAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.activateAccount(req.body);
  const { refreshToken } = result;

  const cookieOptions = {
    secure: config.env === "production",
    httpOnly: true,
  };
  res.cookie("refreshToken", refreshToken, cookieOptions);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Activation code verified successfully.",
    data: result,
  });
});

const loginAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.loginAccount(req.body);
  const { refreshToken } = result;

  const cookieOptions = {
    secure: config.env === "production",
    httpOnly: true,
  };
  res.cookie("refreshToken", refreshToken, cookieOptions);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Log in successful",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  await AuthService.changePassword(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password changed successfully!",
  });
});

const forgotPass = catchAsync(async (req: Request, res: Response) => {
  await AuthService.forgotPass(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Check your email!",
  });
});

const forgetPassOtpVerify = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.forgetPassOtpVerify(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Code verified successfully",
    data: result,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resetPassword(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password has been reset successfully.",
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await AuthService.refreshToken(token);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Access token refreshed successfully",
    data: result,
  });
});

const AuthController = {
  registrationAccount,
  refreshToken,
  activateAccount,
  loginAccount,
  changePassword,
  forgotPass,
  resetPassword,
  forgetPassOtpVerify,
  resendActivationCode,
};

export { AuthController };
