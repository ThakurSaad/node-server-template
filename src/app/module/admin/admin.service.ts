import { status } from "../../../util/httpStatus";
import ApiError from "../../../error/ApiError";
import Auth from "../auth/Auth";
import Admin from "./Admin";
import unlinkFile from "../../../util/unlinkFile";
import { EnumUserRole } from "../../../util/enum";
import { Request } from "express";
import { AuthUserPayload } from "../../../types/auth.types";

const createAdmin = async (payload: {
  name: string;
  email: string;
  password: string;
}) => {
  const { name, email, password } = payload;

  const existing = await Auth.findOne({ email });
  if (existing)
    throw new ApiError(status.CONFLICT, "An account with this email exists");

  // Auth.create runs the pre("save") hook, so the password is hashed.
  // Admin accounts are created pre-activated — no OTP flow.
  const auth = await Auth.create({
    name,
    email,
    password,
    role: EnumUserRole.ADMIN,
    isActive: true,
  });

  const admin = await Admin.create({
    authId: auth._id,
    name,
    email,
  });

  return { _id: admin._id, name, email, role: auth.role };
};

const updateProfile = async (req: Request) => {
  const data = req.body ?? {};
  const { userId, authId } = req.user as AuthUserPayload;
  const files = req.files as
    | {
        [fieldname: string]: Express.Multer.File[];
      }
    | undefined;

  const updatedData: Record<string, string> = {
    ...(data.address && { address: data.address }),
    ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
    ...(data.name && { name: data.name }),
  };

  const existingUser = await Admin.findById(userId).lean();

  let hasNewImage = false;
  if (files && files.profile_image) {
    updatedData.profile_image = files.profile_image[0].path;
    hasNewImage = true;
  }

  const [auth, admin] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updatedData.name },
      {
        returnDocument: "after",
      },
    ),
    Admin.findByIdAndUpdate(
      userId,
      { ...updatedData },
      {
        returnDocument: "after",
      },
    ).populate("authId"),
  ]);

  if (!auth || !admin) throw new ApiError(status.NOT_FOUND, "User not found!");

  if (hasNewImage && existingUser && existingUser.profile_image) {
    await unlinkFile(existingUser.profile_image);
  }

  return admin;
};

const getProfile = async (userData: AuthUserPayload) => {
  const { userId, authId } = userData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId).lean(),
    Admin.findById(userId).populate("authId").lean(),
  ]);

  if (!result || !auth) throw new ApiError(status.NOT_FOUND, "Admin not found");
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  return result;
};

const deleteMyAccount = async (
  userData: AuthUserPayload,
  payload: { password: string },
) => {
  const [auth, admin] = await Promise.all([
    Auth.findById(userData.authId).select("+password").lean(),
    Admin.findById(userData.userId).lean(),
  ]);

  if (!auth || !admin) {
    throw new ApiError(status.NOT_FOUND, "Admin does not exist");
  }
  if (
    !auth.password ||
    !(await Auth.isPasswordMatched(payload.password, auth.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  await Promise.all([
    Auth.deleteOne({ _id: auth._id }),
    Admin.deleteOne({ _id: admin._id }),
  ]);

  if (admin.profile_image) {
    await unlinkFile(admin.profile_image);
  }
};

const AdminService = {
  createAdmin,
  updateProfile,
  getProfile,
  deleteMyAccount,
};

export { AdminService };
