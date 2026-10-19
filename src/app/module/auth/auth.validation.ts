import { z } from "zod";

const email = z.string().email("Please provide a valid email address");
const password = z.string().min(8, "Password must be at least 8 characters");
const otpCode = z.string().min(1, "Code is required");

const register = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    email,
    role: z.string().min(1, "Role is required"),
    password,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  }),
});

const login = z.object({
  body: z.object({
    email,
    password: z.string().min(1, "Password is required"),
  }),
});

const activateAccount = z.object({
  body: z.object({
    email,
    activationCode: otpCode,
  }),
});

const emailOnly = z.object({
  body: z.object({
    email,
  }),
});

const forgetPassOtpVerify = z.object({
  body: z.object({
    email,
    code: otpCode,
  }),
});

const resetPassword = z.object({
  body: z.object({
    email,
    newPassword: password,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  }),
});

const changePassword = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: password,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  }),
});

const refreshToken = z.object({
  body: z.object({
    refreshToken: z.string().optional(), // may come from the cookie instead
  }),
});

const AuthValidation = {
  register,
  login,
  activateAccount,
  emailOnly,
  forgetPassOtpVerify,
  resetPassword,
  changePassword,
  refreshToken,
};

export = AuthValidation;
