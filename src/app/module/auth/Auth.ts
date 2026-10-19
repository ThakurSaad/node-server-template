import { Schema, Types, model, type Model } from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import config from "../../../config";
import { EnumUserRole } from "../../../util/enum";

interface IAuth {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: string;
  isVerified?: boolean;
  isBlocked?: boolean;
  isActive?: boolean;
  verificationCode?: string;
  verificationCodeExpire?: Date;
  verificationAttempts?: number;
  activationCode?: string;
  activationCodeExpire?: Date;
  activationAttempts?: number;
}

interface AuthModel extends Model<IAuth> {
  isAuthExist(email: string): Promise<IAuth | null>;
  isPasswordMatched(
    givenPassword: string,
    savedPassword: string,
  ): Promise<boolean>;
}

const AuthSchema = new Schema<IAuth, AuthModel>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      validate: {
        validator: (value) => validator.isEmail(value),
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(EnumUserRole),
      required: true,
    },
    isVerified: {
      type: Boolean,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
    },
    verificationCodeExpire: {
      type: Date,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
    },
    activationCode: {
      type: String,
    },
    activationCodeExpire: {
      type: Date,
    },
    activationAttempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

AuthSchema.statics.isAuthExist = async function (email: string) {
  return await this.findOne(
    { email },
    {
      name: 1,
      email: 1,
      password: 1,
      role: 1,
      isActive: 1,
      isBlocked: 1,
      isVerified: 1,
    },
  );
};

AuthSchema.statics.isPasswordMatched = async function (
  givenPassword: string,
  savedPassword: string,
) {
  return await bcrypt.compare(givenPassword, savedPassword);
};

AuthSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcrypt_salt_rounds),
  );
});

const Auth = model<IAuth, AuthModel>("Auth", AuthSchema);

export = Auth;
