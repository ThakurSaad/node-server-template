import { z } from "zod";
import objectId from "../../../util/objectIdSchema";

const rating = z.number().int().min(1).max(5);
const reviewText = z.string().trim().min(1, "Review is required");

const postReview = z.object({
  body: z.object({
    rating,
    review: reviewText,
  }),
});

const getOrDeleteReview = z.object({
  query: z.object({
    reviewId: objectId,
  }),
});

const updateReview = z.object({
  body: z.object({
    reviewId: objectId,
    rating: rating.optional(),
    review: reviewText.optional(),
  }),
});

const ReviewValidation = {
  postReview,
  getOrDeleteReview,
  updateReview,
};

export = ReviewValidation;
