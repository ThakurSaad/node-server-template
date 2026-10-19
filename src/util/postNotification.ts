import Notification from "../app/module/notification/Notification";
import AdminNotification from "../app/module/notification/AdminNotification";
import { errorLogger } from "./logger";

const postNotification = async (
  title: string,
  message: string,
  toId: string | null = null,
): Promise<void> => {
  try {
    if (!toId) {
      await AdminNotification.create({ title, message });
    } else {
      await Notification.create({ toId, title, message });
    }
  } catch (error) {
    // fire-and-forget callers: this must never reject
    errorLogger.error("Failed to post notification", error);
  }
};

export = postNotification;
