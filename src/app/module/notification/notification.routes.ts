import express from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import config from "../../../config";
import { NotificationController } from "./notification.controller";
import NotificationValidation from "./notification.validation";

const router = express.Router();

router
  .get(
    "/get-notification",
    auth(config.auth_level.user),
    validateRequest(NotificationValidation.getNotification),
    NotificationController.getNotification,
  )
  .get(
    "/get-all-notifications",
    auth(config.auth_level.user),
    NotificationController.getAllNotifications,
  )
  .patch(
    "/update-as-mark-unread",
    auth(config.auth_level.user),
    validateRequest(NotificationValidation.updateAsReadUnread),
    NotificationController.updateAsReadUnread,
  )
  .delete(
    "/delete-notification",
    auth(config.auth_level.user),
    validateRequest(NotificationValidation.deleteNotification),
    NotificationController.deleteNotification,
  );

export = router;
