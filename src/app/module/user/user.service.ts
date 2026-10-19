import { status } from "../../../util/httpStatus";
import Auth from "../auth/Auth";
import User from "./User";
import ApiError from "../../../error/ApiError";
import unlinkFile from "../../../util/unlinkFile";
import { Request } from "express";
import { AuthUserPayload } from "../../../types/auth.types";

const updateProfile = async (req: Request) => {
  const { userId, authId } = req.user;
  const { name, phoneNumber, address, dateOfBirth } = req.body ?? {};
  // Explicit whitelist: never spread req.body into the document
  // (profile_image, authId and email must not be client-settable)
  const updateData: Record<string, string> = {
    ...(name && { name }),
    ...(phoneNumber && { phoneNumber }),
    ...(address && { address }),
    ...(dateOfBirth && { dateOfBirth }),
  };
  const files = req.files as
    { [fieldname: string]: Express.Multer.File[] } | undefined;

  const existingUser = await User.findById(userId).lean();

  if (files?.profile_image) {
    updateData.profile_image = files.profile_image[0].path;
  }

  const [auth, user] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updateData.name },
      {
        returnDocument: "after",
      },
    ),
    User.findByIdAndUpdate(
      userId,
      { ...updateData },
      {
        returnDocument: "after",
      },
    ).populate("authId"),
  ]);

  if (!auth || !user) throw new ApiError(status.NOT_FOUND, "User not found!");

  if (updateData.profile_image && existingUser?.profile_image) {
    await unlinkFile(existingUser.profile_image);
  }

  return user;
};

const getProfile = async (userData: AuthUserPayload) => {
  const { userId, authId } = userData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId).lean(),
    User.findById(userId).populate("authId").lean(),
  ]);

  if (!auth || !result) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (auth.isBlocked) {
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");
  }

  return result;
};

export const deleteMyAccount = async (
  userData: AuthUserPayload,
  payload: { password: string },
) => {
  const [auth, user] = await Promise.all([
    Auth.findById(userData.authId).select("+password").lean(),
    User.findById(userData.userId).lean(),
  ]);

  if (!auth || !user) {
    throw new ApiError(status.NOT_FOUND, "User does not exist");
  }

  if (
    !auth.password ||
    !(await Auth.isPasswordMatched(payload.password, auth.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  await Promise.all([
    Auth.deleteOne({ _id: auth._id }),
    User.deleteOne({ _id: user._id }),
  ]);

  if (user.profile_image) {
    await unlinkFile(user.profile_image);
  }
};

const UserService = {
  getProfile,
  deleteMyAccount,
  updateProfile,
};

export { UserService };
