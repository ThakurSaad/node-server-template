import { status } from "../../../util/httpStatus";

// import status from "../../../util/httpStatus";
import Auth from "../auth/Auth";
import User from "./User";
import deleteFalsyField from "../../../util/deleteFalsyField";
import ApiError from "../../../error/ApiError";
import unlinkFile from "../../../util/unlinkFile";
import { Request } from "express";
import { AuthUserPayload } from "../../../types/auth.types";

const updateProfile = async (req: Request) => {
  const { body: data } = req;
  const { userId, authId } = req.user;
  const updateData: Record<string, any> = { ...data };
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  deleteFalsyField(data);
  const existingUser = await User.findById(userId).lean();

  let hasNewImage = false;
  if (files && files.profile_image) {
    updateData.profile_image = files.profile_image[0].path;
    hasNewImage = true;
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

  if (hasNewImage && existingUser && existingUser.profile_image) {
    unlinkFile(existingUser.profile_image);
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

export const deleteMyAccount = async (payload: {
  email: string;
  password: string;
}) => {
  const { email, password } = payload;

  const [auth, user] = await Promise.all([
    Auth.findOne({ email }).select("+password").lean(),
    User.findOne({ email }).lean(),
  ]);

  if (!auth || !user) {
    throw new ApiError(status.NOT_FOUND, "User does not exist");
  }

  if (
    auth.password &&
    !(await Auth.isPasswordMatched(password, auth.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  if (user.profile_image) {
    unlinkFile(user.profile_image);
  }

  await Promise.all([
    Auth.deleteOne({ _id: auth._id }),
    User.deleteOne({ _id: user._id }),
  ]);
};

const UserService = {
  getProfile,
  deleteMyAccount,
  updateProfile,
};

export { UserService };
