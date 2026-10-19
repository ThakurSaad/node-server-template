import Auth from "../app/module/auth/Auth";
import { logger } from "../util/logger";

// Belt-and-braces cleanup: expiry is enforced inside the auth services,
// this job just removes stale code fields from the collection.
const cleanupExpiredOtpFields = async (
  check: "activation" | "verification",
) => {
  const now = new Date();
  let result;

  if (check === "activation") {
    result = await Auth.updateMany(
      {
        activationCodeExpire: { $lte: now },
      },
      {
        $unset: {
          activationCode: "",
          activationCodeExpire: "",
          activationAttempts: "",
        },
      },
    );
  }

  if (check === "verification") {
    result = await Auth.updateMany(
      {
        verificationCodeExpire: { $lte: now },
      },
      {
        $unset: {
          isVerified: "",
          verificationCode: "",
          verificationCodeExpire: "",
          verificationAttempts: "",
        },
      },
    );
  }

  if (result && result.modifiedCount > 0)
    logger.info(`Removed ${result.modifiedCount} expired ${check} code`);
};

export { cleanupExpiredOtpFields };
