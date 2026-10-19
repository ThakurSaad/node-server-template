import { status } from "./httpStatus";

import ApiError from "../error/ApiError";
import otpResendTemp from "../mail/otpResendTemp";
import resetPassEmailTemp from "../mail/resetPassEmailTemp";
import signUpEmailTemp from "../mail/signUpEmailTemp";
import { sendEmail } from "../util/sendEmail";

const sendActivationEmail = async (
  email: string,
  data: {
    user: string;
    activationCode: string;
    activationCodeExpire: number;
  },
) => {
  try {
    await sendEmail({
      email,
      subject: "Activate Your Account",
      html: signUpEmailTemp({
        user: data.user,
        activationCode: data.activationCode,
        activationCodeExpire: data.activationCodeExpire.toString(),
      }),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const sendOtpResendEmail = async (
  email: string,
  data: {
    user: string;
    activationCode: string;
    activationCodeExpire: number;
  },
) => {
  try {
    await sendEmail({
      email,
      subject: "New Activation Code",
      html: otpResendTemp({
        user: data.user,
        code: Number(data.activationCode),
        expiresIn: Number(data.activationCodeExpire),
        activationCode: Number(data.activationCode),
        activationCodeExpire: Number(data.activationCodeExpire),
      }),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const sendResetPasswordEmail = async (
  email: string,
  data: {
    user: string;
    verificationCode: string;
    verificationCodeExpire: number;
  },
) => {
  try {
    await sendEmail({
      email,
      subject: "Password Reset Code",
      html: resetPassEmailTemp({
        name: data.user,
        verificationCode: Number(data.verificationCode),
        verificationCodeExpire: data.verificationCodeExpire,
      }),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const EmailHelpers = {
  sendActivationEmail,
  sendOtpResendEmail,
  sendResetPasswordEmail,
};

export = EmailHelpers;
