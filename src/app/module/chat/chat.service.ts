import { status } from "../../../util/httpStatus";
import Chat from "./Chat";
import ApiError from "../../../error/ApiError";
import validateFields from "../../../util/validateFields";
import postNotification from "../../../util/postNotification";
import User from "../user/User";
import mongoose from "mongoose";
import Message from "./Message";
import { AuthUserPayload } from "../../../types/auth.types";

const postChat = async (
  userData: AuthUserPayload,
  payload: Record<string, unknown>,
) => {
  const userId = String(userData.userId);
  const receiverId = String(payload.receiverId);

  validateFields(payload, ["receiverId"]);

  const [user, receiver, existingChat] = await Promise.all([
    User.findById(userId).lean(),
    User.findById(receiverId).lean(),
    Chat.findOne({
      participants: { $all: [userId, receiverId] },
    }),
  ]);

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (!receiver) {
    throw new ApiError(status.NOT_FOUND, "Receiver not found");
  }
  if (existingChat) {
    return existingChat;
  }

  const newChat = await Chat.create({
    participants: [userId, receiverId],
  });

  postNotification(
    "New message",
    "You have started a new conversation",
    receiverId,
  );
  postNotification(
    "New message",
    "You have started a new conversation",
    userId,
  );

  return newChat;
};

const getChatMessages = async (
  userData: AuthUserPayload,
  query: Record<string, unknown>,
) => {
  /**
   * Paginate ONLY the messages array while keeping the existing response format.
   * Accepts optional `page` & `limit` query params (default 1 & 10).
   */
  validateFields(query, ["chatId"]);

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  const chat = await Chat.findOne({ _id: query.chatId })
    .populate({
      path: "participants",
      select: "name phoneNumber profile_image",
    })
    .lean();

  if (!chat) throw new ApiError(status.NOT_FOUND, "Chat not found");

  const [total, messages] = await Promise.all([
    Message.countDocuments({ chatId: chat._id }),
    Message.find({ chatId: chat._id })
      .sort({ createdAt: -1 }) // newest first; adjust as needed
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
    ...chat,
    messages,
  };
};

const getAllChats = async (userData: AuthUserPayload) => {
  const userId = mongoose.Types.ObjectId.createFromHexString(userData.userId);

  const chats = await Chat.aggregate([
    {
      $match: {
        participants: {
          $in: [userId],
        },
      },
    },
    {
      $lookup: {
        from: "messages",
        let: {
          chatId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$chatId", "$$chatId"] },
                  { $eq: ["$receiver", userId] },
                  { $eq: ["$isRead", false] },
                ],
              },
            },
          },
        ],
        as: "unreadMessages",
      },
    },
    {
      $addFields: {
        unRead: { $size: "$unreadMessages" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        as: "participants",
      },
    },
    {
      $project: {
        unreadMessages: 0,
      },
    },
  ]);

  return {
    // meta,
    chats,
  };
};

const updateMessageAsSeen = async (
  userData: AuthUserPayload,
  payload: Record<string, unknown>,
) => {
  /**
   * Updates all unread messages in a chat as seen for the logged-in user
   * Meaning update unread messages where the logged-in user is the receiver
   */
  const userId = userData.userId; // logged in user who's viewing the chat

  validateFields(payload, ["chatId"]);

  const chat = await Chat.findById(payload.chatId).lean();

  if (!chat) {
    throw new ApiError(status.NOT_FOUND, "Chat not found");
  }

  const result = await Message.updateMany(
    {
      chatId: chat._id,
      receiver: userId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
      },
    },
  );

  return result;
};

const ChatService = {
  postChat,
  getChatMessages,
  getAllChats,
  updateMessageAsSeen,
};

export { ChatService };
