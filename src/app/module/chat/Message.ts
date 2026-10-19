import { Schema, model, Types } from "mongoose";

interface IMessage {
  chatId: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  message: string;
  isRead: boolean;
}

const messageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

// Hot path: paginated message history for a chat, newest first
messageSchema.index({ chatId: 1, createdAt: -1 });
// Hot path: unread counts per receiver
messageSchema.index({ receiver: 1, isRead: 1 });

const Message = model<IMessage>("Message", messageSchema);

export = Message;
