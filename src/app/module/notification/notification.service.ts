import { status } from "../../../util/httpStatus";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";
import isAdmin from "../../../util/isAdmin";
import AdminNotification from "./AdminNotification";
import Notification from "./Notification";
import { AuthUserPayload } from "../../../types/auth.types";
import { IAdminNotification } from "./AdminNotification.interface";
import { INotification } from "./Notification.interface";

const getNotification = async (
  userData: AuthUserPayload,
  query: Record<string, unknown>,
) => {
  // Users reach only their own notification; admins share the admin inbox
  const notification = isAdmin(userData.role)
    ? await AdminNotification.findById(query.notificationId).lean()
    : await Notification.findOne({
        _id: query.notificationId,
        toId: userData.userId,
      }).lean();

  if (!notification) {
    throw new ApiError(status.NOT_FOUND, "Notification not found");
  }
  return notification;
};

/**
 * Retrieves notifications based on the user's role.
 *
 * - If the user is an **admin**, it fetches all notifications from `AdminNotification`.
 * - If the user is a **regular user**, it fetches only notifications relevant to them from `Notification`.
 */
const getAllNotifications = async (
  userData: AuthUserPayload,
  query: QueryParams,
) => {
  const { role, userId } = userData;

  if (isAdmin(role)) {
    const notificationQuery = new QueryBuilder<IAdminNotification>(
      AdminNotification.find().lean(),
      query,
    )
      .search([])
      .filter()
      .sort()
      .paginate()
      .fields();

    const [notifications, meta] = await Promise.all([
      notificationQuery.modelQuery,
      notificationQuery.countTotal(),
    ]);

    if (!notifications) {
      throw new ApiError(status.NOT_FOUND, "Notifications not found");
    }

    return { meta, notifications };
  } else {
    const notificationQuery = new QueryBuilder<INotification>(
      Notification.find({ toId: userId }).lean(),
      query,
    )
      .search([])
      .filter()
      .sort()
      .paginate()
      .fields();

    const [notifications, meta] = await Promise.all([
      notificationQuery.modelQuery,
      notificationQuery.countTotal(),
    ]);

    if (!notifications) {
      throw new ApiError(status.NOT_FOUND, "Notifications not found");
    }

    return { meta, notifications };
  }
};

const updateAsReadUnread = async (
  userData: AuthUserPayload,
  payload: Record<string, unknown>,
) => {
  // Idempotent: marking already-read notifications as read is not an error
  if (isAdmin(userData.role))
    return AdminNotification.updateMany(
      {},
      { $set: { isRead: payload.isRead } },
    );

  return Notification.updateMany(
    { toId: userData.userId },
    { $set: { isRead: payload.isRead } },
  );
};

const deleteNotification = async (
  userData: AuthUserPayload,
  payload: Record<string, unknown>,
) => {
  // Users delete only their own notification; admins share the admin inbox
  const result = isAdmin(userData.role)
    ? await AdminNotification.findByIdAndDelete(payload.notificationId)
    : await Notification.findOneAndDelete({
        _id: payload.notificationId,
        toId: userData.userId,
      });

  if (!result) {
    throw new ApiError(status.NOT_FOUND, "Notification not found");
  }
  return result;
};

const NotificationService = {
  getNotification,
  getAllNotifications,
  updateAsReadUnread,
  deleteNotification,
};

export { NotificationService };
