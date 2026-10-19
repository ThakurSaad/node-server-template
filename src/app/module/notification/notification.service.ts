import { status } from "../../../util/httpStatus";
// import { default: status } from "../../../util/httpStatus";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";
import validateFields from "../../../util/validateFields";
import { EnumUserRole } from "../../../util/enum";
import AdminNotification from "./AdminNotification";
import Notification from "./Notification";
import { AuthUserPayload } from "../../../types/auth.types";
import { IAdminNotification } from "./AdminNotification.interface";
import { INotification } from "./Notification.interface";

const getNotification = async (
  userData: AuthUserPayload,
  query: Record<string, unknown>,
) => {
  const { role } = userData;
  if (role !== EnumUserRole.ADMIN) validateFields(query, ["notificationId"]);

  if (role === EnumUserRole.ADMIN) {
    const notification = await AdminNotification.findOne({}).lean();
    if (!notification) {
      throw new ApiError(status.NOT_FOUND, "Notification not found");
    }
    return notification;
  }

  const notification = await Notification.findOne({
    _id: query.notificationId,
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

  if (role === EnumUserRole.ADMIN) {
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
  const { role } = userData;

  if (role === EnumUserRole.ADMIN) {
    const result = await AdminNotification.updateMany(
      {},
      {
        $set: { isRead: payload.isRead },
      },
    );

    if (!result.modifiedCount) {
      throw new ApiError(status.BAD_REQUEST, "Already updated");
    }

    return result;
  }

  const result = await Notification.updateMany(
    {
      toId: userData.userId,
    },
    {
      $set: { isRead: payload.isRead },
    },
  );

  if (!result.modifiedCount) {
    throw new ApiError(status.BAD_REQUEST, "Already updated");
  }

  return result;
};

const deleteNotification = async (
  userData: AuthUserPayload,
  payload: Record<string, unknown>,
) => {
  const { role } = userData;
  validateFields(payload, ["notificationId"]);

  if (role === EnumUserRole.ADMIN) {
    const result = await AdminNotification.findByIdAndDelete(
      payload.notificationId,
    );
    if (!result) {
      throw new ApiError(status.NOT_FOUND, "Notification not found");
    }
    return result;
  }

  const result = await Notification.findByIdAndDelete(payload.notificationId);
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
