import { status } from "../../../util/httpStatus";
import ApiError from "../../../error/ApiError";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";
import postNotification from "../../../util/postNotification";
import Feedback from "./Feedback";
import User from "../user/User";
import validateFields from "../../../util/validateFields";
import { EnumUserRole } from "../../../util/enum";

interface UserData {
  userId: string;
  role: string;
}

interface FeedbackPayload {
  feedback: string;
  name?: string;
  email?: string;
  feedbackId?: string;
  reply?: string;
}

const postFeedback = async (
  userData: UserData | null,
  payload: FeedbackPayload,
) => {
  validateFields(payload, ["feedback"]);

  let user: { name: string; email: string } | null = null;

  if (!userData) {
    validateFields(payload, ["name", "email"]);
  } else {
    user = await User.findById(userData.userId).lean();
  }

  const feedbackData = {
    ...(userData &&
      user && {
        user: userData.userId,
        name: user.name,
        email: user.email,
      }),
    ...(!userData && {
      name: payload.name,
      email: payload.email,
    }),
    feedback: payload.feedback,
  };

  const feedback = await Feedback.create(feedbackData);

  if (userData) {
    postNotification(
      "Thank You",
      "Thank you for your valuable feedback 🫡",
      userData.userId,
    );
  }

  postNotification(
    "New Feedback",
    "Mount Fuji got a new feedback. Check it out!",
  );

  return feedback;
};

const getFeedback = async (
  userData: UserData,
  query: { feedbackId?: string },
) => {
  validateFields(query, ["feedbackId"]);

  const feedback = await Feedback.findById(query.feedbackId);
  if (!feedback) throw new ApiError(status.NOT_FOUND, "Feedback not found");

  return feedback;
};

const getMyFeedback = async (userData: UserData) => {
  const { userId } = userData;

  const feedback = await Feedback.find({ user: userId });
  if (!feedback.length)
    throw new ApiError(status.NOT_FOUND, "Feedback not found");

  return {
    count: feedback.length,
    feedback,
  };
};

const getAllFeedbacks = async (userData: UserData, query: QueryParams) => {
  const queryObj =
    userData.role === EnumUserRole.ADMIN ? {} : { user: userData.userId };

  const feedbackQuery = new QueryBuilder(Feedback.find(queryObj).lean(), query)
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [feedback, meta] = await Promise.all([
    feedbackQuery.modelQuery,
    feedbackQuery.countTotal(),
  ]);

  return { meta, feedback };
};

const updateFeedbackWithReply = async (
  userData: UserData,
  payload: FeedbackPayload,
) => {
  validateFields(payload, ["feedbackId", "reply"]);

  const feedback = await Feedback.findByIdAndUpdate(
    payload.feedbackId,
    { reply: payload.reply },
    { returnDocument: "after", runValidators: true },
  );

  if (!feedback) throw new ApiError(status.NOT_FOUND, "Feedback not found");

  if (feedback.user) {
    postNotification(
      "Feedback Reply",
      "Admin has replied to your feedback",
      String(feedback.user),
    );
  }

  return feedback;
};

const deleteFeedback = async (userData: UserData, payload: FeedbackPayload) => {
  validateFields(payload, ["feedbackId"]);

  const result = await Feedback.deleteOne({ _id: payload.feedbackId });

  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Feedback not found");

  return result;
};

const FeedbackService = {
  postFeedback,
  getFeedback,
  getMyFeedback,
  getAllFeedbacks,
  updateFeedbackWithReply,
  deleteFeedback,
};

export { FeedbackService };
