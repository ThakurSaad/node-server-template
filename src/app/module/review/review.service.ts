import { status } from "../../../util/httpStatus";
import ApiError from "../../../error/ApiError";
import QueryBuilder from "../../../builder/queryBuilder";
import { QueryParams } from "../../../types/common.types";
import isAdmin from "../../../util/isAdmin";
import Review from "./Review";

interface UserData {
  userId: string;
  role: string;
}

const postReview = async (
  userData: UserData,
  payload: { rating: number; review: string },
) =>
  Review.create({
    user: userData.userId,
    rating: payload.rating,
    review: payload.review,
  });

const getAllReviews = async (userData: UserData, query: QueryParams) => {
  const queryObj = isAdmin(userData.role) ? {} : { user: userData.userId };

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
  // Users reach only their own review; admins can read any
  const filter = isAdmin(userData.role)
    ? { _id: query.reviewId }
    : { _id: query.reviewId, user: userData.userId };

  const review = await Review.findOne(filter).lean();
  if (!review) throw new ApiError(status.NOT_FOUND, "Review not found");

  return review;
};

const updateReview = async (
  userData: UserData,
  payload: Record<string, unknown>,
) => {
  const updateData = {
    ...(payload.rating && { rating: payload.rating }),
    ...(payload.review && { review: payload.review }),
  };

  // Owner only: admins can read and delete any review, but never edit its text
  const result = await Review.findOneAndUpdate(
    { _id: payload.reviewId, user: userData.userId },
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
  // Users delete only their own review; admins can delete any
  const filter = isAdmin(userData.role)
    ? { _id: payload.reviewId }
    : { _id: payload.reviewId, user: userData.userId };

  const result = await Review.deleteOne(filter);

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
