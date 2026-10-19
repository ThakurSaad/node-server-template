import { status } from "../../../util/httpStatus";
import ApiError from "../../../error/ApiError";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";
import validateFields from "../../../util/validateFields";
import { EnumUserRole } from "../../../util/enum";
import Review from "./Review";

interface UserData {
  userId: string;
  role: string;
}

const postReview = async () => {};

const getAllReviews = async (userData: UserData, query: QueryParams) => {
  const queryObj =
    userData.role === EnumUserRole.ADMIN ? {} : { user: userData.userId };

  const reviewQuery = new QueryBuilder(
    Review.find(queryObj)
      .populate([{ path: "user", select: "-createdAt -updatedAt -__v" }])
      .lean(),
    query,
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    reviewQuery.modelQuery,
    reviewQuery.countTotal(),
  ]);

  return { meta, result };
};

const getReview = async (userData: UserData, query: { reviewId?: string }) => {
  validateFields(query, ["reviewId"]);

  const review = await Review.findById(query.reviewId).lean();
  if (!review) throw new ApiError(status.NOT_FOUND, "Review not found");

  return review;
};

const updateReview = async (
  userData: UserData,
  payload: Record<string, unknown>,
) => {
  validateFields(payload, ["reviewId"]);

  const updateData = {
    ...(payload.rating && { rating: payload.rating }),
    ...(payload.review && { review: payload.review }),
  };

  const result = await Review.findByIdAndUpdate(
    payload.reviewId,
    { $set: updateData },
    { returnDocument: "after", runValidators: true },
  );

  if (!result) throw new ApiError(status.NOT_FOUND, "Review not found");

  return result;
};

const deleteReview = async (
  userData: UserData,
  payload: { reviewId?: string },
) => {
  validateFields(payload, ["reviewId"]);

  const result = await Review.deleteOne({ _id: payload.reviewId });

  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Review not found");

  return result;
};

const ReviewService = {
  postReview,
  getAllReviews,
  getReview,
  updateReview,
  deleteReview,
};

export { ReviewService };
