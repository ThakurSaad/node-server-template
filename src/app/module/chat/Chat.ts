import { Schema, model, Types } from "mongoose";

// Messages live in their own collection keyed by chatId — storing them
// as an array here would grow the document unboundedly (16 MB cap).
interface IChat {
  participants: Types.ObjectId[];
}

const chatSchema = new Schema<IChat>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  },
);

chatSchema.index({ participants: 1 });

const Chat = model<IChat>("Chat", chatSchema);

export = Chat;
