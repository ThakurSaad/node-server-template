import { Schema, model, Types } from "mongoose";

interface IFeedback {
  user?: Types.ObjectId;
  name: string;
  email: string;
  feedback: string;
  reply?: string;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    feedback: {
      type: String,
      required: true,
    },
    reply: {
      type: String,
    },
  },
  { timestamps: true },
);

const Feedback = model<IFeedback>("Feedback", feedbackSchema);

export = Feedback;
