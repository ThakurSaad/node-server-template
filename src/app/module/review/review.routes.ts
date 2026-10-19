import { Router } from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { ReviewController } from "./review.controller";
import ReviewValidation from "./review.validation";
import config from "../../../config";

const router = Router();

router
  .post(
    "/post-review",
    auth(config.auth_level.user),
    validateRequest(ReviewValidation.postReview),
    ReviewController.postReview,
  )
  .get(
    "/get-all-reviews",
    auth(config.auth_level.user),
    ReviewController.getAllReviews,
  )
  .get(
    "/get-review",
    auth(config.auth_level.user),
    validateRequest(ReviewValidation.getOrDeleteReview),
    ReviewController.getReview,
  )
  .patch(
    "/update-review",
    auth(config.auth_level.user),
    validateRequest(ReviewValidation.updateReview),
    ReviewController.updateReview,
  )
  .delete(
    "/delete-review",
    auth(config.auth_level.user),
    validateRequest(ReviewValidation.getOrDeleteReview),
    ReviewController.deleteReview,
  );

export = router;
