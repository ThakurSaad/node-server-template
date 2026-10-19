import { Schema, model } from "mongoose";
import type { INotification } from "./Notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    toId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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

// Hot path: unread notification list per user
notificationSchema.index({ toId: 1, isRead: 1 });

const Notification = model<INotification>("Notification", notificationSchema);

export default Notification;
