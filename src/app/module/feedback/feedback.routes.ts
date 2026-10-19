import { Router } from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { FeedbackController } from "./feedback.controller";
import FeedbackValidation from "./feedback.validation";
import config from "../../../config";

const router = Router();

router
  .post(
    "/post-feedback",
    auth(config.auth_level.user, false),
    validateRequest(FeedbackValidation.postFeedback),
    FeedbackController.postFeedback,
  )
  .get(
    "/get-feedback",
    auth(config.auth_level.user),
    validateRequest(FeedbackValidation.getFeedback),
    FeedbackController.getFeedback,
  )
  .get(
    "/get-all-feedbacks",
    auth(config.auth_level.user),
    FeedbackController.getAllFeedbacks,
  )
  .patch(
    "/update-feedback-with-reply",
    auth(config.auth_level.admin),
    validateRequest(FeedbackValidation.updateFeedbackWithReply),
    FeedbackController.updateFeedbackWithReply,
  )
  .delete(
    "/delete-feedback",
    auth(config.auth_level.user),
    validateRequest(FeedbackValidation.deleteFeedback),
    FeedbackController.deleteFeedback,
  );

export = router;
