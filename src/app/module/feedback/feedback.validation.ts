import { z } from "zod";
import objectId from "../../../util/objectIdSchema";

const name = z.string().trim().min(1, "Name is required");
const email = z.string().email("Please provide a valid email address");

const postFeedback = z.object({
  body: z.object({
    feedback: z.string().trim().min(1, "Feedback is required"),
    name: name.optional(),
    email: email.optional(),
  }),
});

const getFeedback = z.object({
  query: z.object({
    feedbackId: objectId,
  }),
});

const deleteFeedback = z.object({
  body: z.object({
    feedbackId: objectId,
  }),
});

const updateFeedbackWithReply = z.object({
  body: z.object({
    feedbackId: objectId,
    reply: z.string().trim().min(1, "Reply is required"),
  }),
});

const FeedbackValidation = {
  postFeedback,
  getFeedback,
  deleteFeedback,
  updateFeedbackWithReply,
};

export = FeedbackValidation;
