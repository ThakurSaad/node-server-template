import { status } from "../../../util/httpStatus";
import { SignOptions } from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

import ApiError from "../../../error/ApiError";
import config from "../../../config";
import { jwtHelpers } from "../../../util/jwtHelpers";
import { EnumUserRole } from "../../../util/enum";
import Auth from "./Auth";
import codeGenerator from "../../../util/codeGenerator";
import User from "../user/User";
import Admin from "../admin/Admin";
import validateFields from "../../../util/validateFields";
import EmailHelpers from "../../../util/emailHelpers";
import { AuthUserPayload } from "../../../types/auth.types";

const MAX_OTP_ATTEMPTS = 5;

// Only a keyed hash of each OTP is stored. HMAC rather than a bare sha256:
// 6-digit codes are enumerable in milliseconds, the key makes a leaked hash useless
const hashOtp = (code: string) =>
  crypto.createHmac("sha256", config.jwt.secret).update(code).digest("hex");

const invalidateActivationCode = async (email: string) => {
  await Auth.updateOne(
    { email },
    {
      $unset: {
        activationCode: "",
        activationCodeExpire: "",
        activationAttempts: "",
      },
    },
  );
};

const invalidateVerificationCode = async (email: string) => {
  await Auth.updateOne(
    { email },
    {
      $unset: {
        verificationCode: "",
        verificationCodeExpire: "",
        verificationAttempts: "",
      },
    },
  );
};

const registrationAccount = async (payload: {
  role: string;
  name: string;
  password: string;
  confirmPassword: string;
  email: string;
}) => {
  const { role, name, password, confirmPassword, email } = payload;

  validateFields(payload, [
    "password",
    "confirmPassword",
    "email",
    "role",
    "name",
  ]);

  const { code: activationCode, expiredAt } = codeGenerator(3);
  const activationCodeExpire = new Date(expiredAt);
  const authData = {
    role,
    name,
    email,
    password,
    activationCode: hashOtp(activationCode),
    activationCodeExpire,
  };
  const data = {
    user: name,
    activationCode,
    activationCodeExpire: Math.round(
      (activationCodeExpire.getTime() - Date.now()) / (60 * 1000),
    ),
  };

  // Only USER accounts may self-register. Admins are created by a
  // super admin (POST /admin/create-admin) or the seed script.
  const selfRegisterableRoles: string[] = [EnumUserRole.USER];
  if (!selfRegisterableRoles.includes(role))
    throw new ApiError(status.BAD_REQUEST, "Invalid role");
  if (password !== confirmPassword)
    throw new ApiError(
      status.BAD_REQUEST,
      "Password and Confirm Password didn't match",
    );

  const user = await Auth.findOne({ email });
  if (user) {
    const message = user.isActive
      ? "Account active. Please Login"
      : "Already have an account. Please activate";

    if (!user.isActive) {
      user.activationCode = hashOtp(activationCode);
      user.activationCodeExpire = activationCodeExpire;
      user.activationAttempts = 0;
      await user.save();

      await EmailHelpers.sendOtpResendEmail(email, data);
    }

    return {
      isActive: user.isActive,
      message,
    };
  }

  // Persist first, then email: never send a code for an account that failed
  // to save. If the email fails, the account still exists and "resend" works.
  const auth = await Auth.create(authData);
  try {
    await User.create({ authId: auth._id, name, email });
  } catch (error) {
    await Auth.deleteOne({ _id: auth._id }); // never leave an Auth without a profile
    throw error;
  }

  await EmailHelpers.sendActivationEmail(email, data);

  return {
    isActive: false,
    message: "Account created successfully. Please check your email",
  };
};

const resendActivationCode = async (payload: { email: string }) => {
  const email = payload.email;

  const user = await Auth.isAuthExist(email);
  if (!user) throw new ApiError(status.BAD_REQUEST, "Email not found!");

  const { code: activationCode, expiredAt } = codeGenerator(3);
  const activationCodeExpire = new Date(expiredAt);
  const data = {
    user: user.name,
    activationCode,
    activationCodeExpire: Math.round(
      (activationCodeExpire.getTime() - Date.now()) / (60 * 1000),
    ),
  };

  await Auth.updateOne(
    { _id: user._id },
    {
      activationCode: hashOtp(activationCode),
      activationCodeExpire,
      activationAttempts: 0,
    },
  );

  await EmailHelpers.sendOtpResendEmail(email, data);
};

const activateAccount = async (payload: {
  activationCode: string;
  email: string;
}) => {
  const { activationCode, email } = payload;

  const auth = await Auth.findOne({ email });
  if (!auth) throw new ApiError(status.NOT_FOUND, "User not found");
  if (!auth.activationCode)
    throw new ApiError(
      status.NOT_FOUND,
      "Activation code not found. Get a new activation code",
    );
  if (!auth.activationCodeExpire || auth.activationCodeExpire < new Date())
    throw new ApiError(
      status.BAD_REQUEST,
      "Activation code expired. Get a new activation code",
    );
  if ((auth.activationAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    await invalidateActivationCode(email);
    throw new ApiError(
      status.TOO_MANY_REQUESTS,
      "Too many attempts. Get a new activation code",
    );
  }
  if (auth.activationCode !== hashOtp(activationCode)) {
    await Auth.updateOne({ email }, { $inc: { activationAttempts: 1 } });
    throw new ApiError(status.BAD_REQUEST, "Code didn't match!");
  }

  await Auth.updateOne(
    { email: email },
    {
      isActive: true,
      $unset: {
        activationCode: "",
        activationCodeExpire: "",
        activationAttempts: "",
      },
    },
    {
      runValidators: true,
    },
  );

  let result;
  switch (auth.role) {
    case EnumUserRole.ADMIN:
    case EnumUserRole.SUPER_ADMIN:
      result = await Admin.findOne({ authId: auth._id }).lean();
      break;
    default:
      result = await User.findOne({ authId: auth._id }).lean();
  }

  if (!result) throw new ApiError(status.NOT_FOUND, "Account detail not found");

  const tokenPayload = {
    authId: auth._id,
    userId: result._id,
    email,
    role: auth.role,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in as SignOptions["expiresIn"],
  );
  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refresh_secret,
    config.jwt.refresh_expires_in as SignOptions["expiresIn"],
  );

  return {
    accessToken,
    refreshToken,
  };
};

const loginAccount = async (payload: { email: string; password: string }) => {
  const { email, password } = payload;

  const auth = await Auth.isAuthExist(email);

  if (!auth) throw new ApiError(status.NOT_FOUND, "User does not exist");
  if (!auth.isActive)
    throw new ApiError(
      status.BAD_REQUEST,
      "Please activate your account then try to login",
    );
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  if (
    auth.password &&
    !(await Auth.isPasswordMatched(password, auth.password))
  ) {
    throw new ApiError(status.BAD_REQUEST, "Password is incorrect");
  }

  let result;
  switch (auth.role) {
    case EnumUserRole.ADMIN:
    case EnumUserRole.SUPER_ADMIN:
      result = await Admin.findOne({ authId: auth._id }).populate("authId");
      break;
    default:
      result = await User.findOne({ authId: auth._id }).populate("authId");
  }

  if (!result) throw new ApiError(status.NOT_FOUND, "Account detail not found");

  const tokenPayload = {
    authId: String(auth._id),
    userId: String(result._id),
    email,
    role: auth.role,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in as SignOptions["expiresIn"],
  );

  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refresh_secret,
    config.jwt.refresh_expires_in as SignOptions["expiresIn"],
  );

  return {
    accessToken,
    refreshToken,
  };
};

const forgotPass = async (payload: { email: string }) => {
  const { email } = payload;

  if (!email) throw new ApiError(status.BAD_REQUEST, "Missing email");

  const user = await Auth.isAuthExist(email);
  if (!user) throw new ApiError(status.BAD_REQUEST, "User not found!");

  const { code: verificationCode, expiredAt } = codeGenerator(3);
  const verificationCodeExpire = new Date(expiredAt);

  await Auth.updateOne(
    { _id: user._id },
    {
      verificationCode: hashOtp(verificationCode),
      verificationCodeExpire,
      verificationAttempts: 0,
    },
  );

  const data = {
    user: user.name,
    verificationCode,
    verificationCodeExpire: Math.round(
      (verificationCodeExpire.getTime() - Date.now()) / (60 * 1000),
    ),
  };

  await EmailHelpers.sendResetPasswordEmail(email, data);
};

// Expiry, attempt cap and match check, shared by verify and reset
const checkVerificationCode = async (email: string, code: string) => {
  const auth = await Auth.findOne({ email });
  if (!auth) throw new ApiError(status.NOT_FOUND, "Account does not exist!");
  if (!auth.verificationCode)
    throw new ApiError(
      status.NOT_FOUND,
      "No verification code. Get a new verification code",
    );
  if (!auth.verificationCodeExpire || auth.verificationCodeExpire < new Date())
    throw new ApiError(
      status.BAD_REQUEST,
      "Verification code expired. Get a new verification code",
    );
  if ((auth.verificationAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    await invalidateVerificationCode(email);
    throw new ApiError(
      status.TOO_MANY_REQUESTS,
      "Too many attempts. Get a new verification code",
    );
  }
  if (auth.verificationCode !== hashOtp(code)) {
    await Auth.updateOne({ email }, { $inc: { verificationAttempts: 1 } });
    throw new ApiError(status.BAD_REQUEST, "Invalid verification code!");
  }
};

// Only checks the code (so the client can show the new-password form). It
// changes no state: reset-password checks the code again.
const forgetPassOtpVerify = async (payload: {
  email: string;
  code: string;
}) => {
  await checkVerificationCode(payload.email, payload.code);
};

const resetPassword = async (payload: {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  const { email, code, newPassword, confirmPassword } = payload;

  if (newPassword !== confirmPassword)
    throw new ApiError(status.BAD_REQUEST, "Passwords do not match");

  await checkVerificationCode(email, code);

  const hashedPassword = await hashPass(newPassword);

  await Auth.updateOne(
    { email },
    {
      $set: { password: hashedPassword },
      $unset: {
        verificationCode: "",
        verificationCodeExpire: "",
        verificationAttempts: "",
      },
    },
  );
};

const refreshToken = async (token: string) => {
  if (!token)
    throw new ApiError(status.UNAUTHORIZED, "Refresh token is required");

  let verified: AuthUserPayload;
  try {
    verified = jwtHelpers.verifyToken<AuthUserPayload>(
      token,
      config.jwt.refresh_secret,
    );
  } catch {
    throw new ApiError(status.UNAUTHORIZED, "Invalid refresh token");
  }

  const auth = await Auth.findById(verified.authId);
  if (!auth) throw new ApiError(status.UNAUTHORIZED, "Account does not exist");
  if (!auth.isActive)
    throw new ApiError(status.FORBIDDEN, "Account is not activated");
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  let result;
  switch (auth.role) {
    case EnumUserRole.ADMIN:
    case EnumUserRole.SUPER_ADMIN:
      result = await Admin.findOne({ authId: auth._id }).lean();
      break;
    default:
      result = await User.findOne({ authId: auth._id }).lean();
  }

  if (!result) throw new ApiError(status.NOT_FOUND, "Account detail not found");

  const tokenPayload = {
    authId: String(auth._id),
    userId: String(result._id),
    email: auth.email,
    role: auth.role,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in as SignOptions["expiresIn"],
  );

  return { accessToken };
};

const changePassword = async (
  userData: AuthUserPayload,
  payload: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
) => {
  const { email } = userData;
  const { oldPassword, newPassword, confirmPassword } = payload;

  validateFields(payload, ["oldPassword", "newPassword", "confirmPassword"]);

  if (newPassword !== confirmPassword)
    throw new ApiError(
      status.BAD_REQUEST,
      "Password and confirm password do not match",
    );

  const isUserExist = await Auth.isAuthExist(email);

  if (!isUserExist)
    throw new ApiError(status.NOT_FOUND, "Account does not exist!");
  if (
    isUserExist.password &&
    !(await Auth.isPasswordMatched(oldPassword, isUserExist.password))
  ) {
    throw new ApiError(status.BAD_REQUEST, "Old password is incorrect");
  }

  const hashedPassword = await hashPass(newPassword);

  await Auth.updateOne({ email }, { password: hashedPassword });
};

const hashPass = async (newPassword: string) => {
  return await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));
};

const AuthService = {
  registrationAccount,
  loginAccount,
  changePassword,
  forgotPass,
  resetPassword,
  activateAccount,
  forgetPassOtpVerify,
  resendActivationCode,
  refreshToken,
};

export { AuthService };
