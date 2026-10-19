import express from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { AuthController } from "../auth/auth.controller";
import AuthValidation from "./auth.validation";
import config from "../../../config";
import limiter, { createLimiter } from "../../middleware/limiter";

const router = express.Router();

// OTP endpoints get tighter limits: sending codes is costlier than verifying
const otpSendLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 3 });
const otpVerifyLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 5 });

router
  .post(
    "/register",
    validateRequest(AuthValidation.register),
    AuthController.registrationAccount,
  )
  .post(
    "/login",
    limiter,
    validateRequest(AuthValidation.login),
    AuthController.loginAccount,
  )
  .post(
    "/refresh-token",
    otpVerifyLimiter,
    validateRequest(AuthValidation.refreshToken),
    AuthController.refreshToken,
  )
  .post(
    "/activate-account",
    otpVerifyLimiter,
    validateRequest(AuthValidation.activateAccount),
    AuthController.activateAccount,
  )
  .post(
    "/activation-code-resend",
    otpSendLimiter,
    validateRequest(AuthValidation.emailOnly),
    AuthController.resendActivationCode,
  )
  .post(
    "/forgot-password",
    otpSendLimiter,
    validateRequest(AuthValidation.emailOnly),
    AuthController.forgotPass,
  )
  .post(
    "/forget-pass-otp-verify",
    otpVerifyLimiter,
    validateRequest(AuthValidation.forgetPassOtpVerify),
    AuthController.forgetPassOtpVerify,
  )
  .post(
    "/reset-password",
    otpVerifyLimiter,
    validateRequest(AuthValidation.resetPassword),
    AuthController.resetPassword,
  )
  .patch(
    "/change-password",
    auth(config.auth_level.user),
    validateRequest(AuthValidation.changePassword),
    AuthController.changePassword,
  );

export = router;
