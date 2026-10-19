import { Schema, model } from "mongoose";
import type { IAdminNotification } from "./AdminNotification.interface";

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const AdminNotification = model<IAdminNotification>(
  "AdminNotification",
  adminNotificationSchema,
);

export = AdminNotification;
