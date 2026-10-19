import { z } from "zod";
import objectId from "../../../util/objectIdSchema";

const getNotification = z.object({
  query: z.object({
    notificationId: objectId,
  }),
});

const updateAsReadUnread = z.object({
  body: z.object({
    isRead: z.boolean(),
  }),
});

const deleteNotification = z.object({
  body: z.object({
    notificationId: objectId,
  }),
});

const NotificationValidation = {
  getNotification,
  updateAsReadUnread,
  deleteNotification,
};

export = NotificationValidation;
