import { Schema, model } from "mongoose";
import type { IUser } from "./user.interface";

const UserSchema = new Schema<IUser>(
  {
    authId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Auth",
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    profile_image: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    dateOfBirth: {
      type: String,
    },
    address: {
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    locationCoordinates: {
      // default: undefined keeps the field absent until a location is set —
      // a bare { type: "Point" } without coordinates breaks the 2dsphere index
      type: new Schema(
        {
          type: {
            type: String,
            enum: ["Point"],
            default: "Point",
          },
          coordinates: {
            type: [Number],
          },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

// Geospatial queries on live location updates
UserSchema.index({ locationCoordinates: "2dsphere" });

const User = model<IUser>("User", UserSchema);

export = User;
