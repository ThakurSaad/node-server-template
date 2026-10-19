import { status } from "../util/httpStatus";

import emitResult from "./emitResult";
import Chat from "../app/module/chat/Chat";
import Message from "../app/module/chat/Message";
import { EnumSocketEvent } from "../util/enum";
import postNotification from "../util/postNotification";
import validateSocketFields from "../util/validateSocketFields";
import emitError from "./emitError";
import socketCatchAsync from "../util/socketCatchAsync";
import { Server, Socket } from "socket.io";

const sendMessage = socketCatchAsync(
  async (socket: Socket, io: Server, payload: any): Promise<any> => {
    validateSocketFields(socket, payload, ["receiverId", "chatId", "message"]);
    const { userId, receiverId, chatId, message } = payload;

    const existingChat = await Chat.findOne({
      _id: chatId,
      participants: { $all: [userId, receiverId] },
    });

    if (!existingChat) {
      return emitError(
        socket,
        status.NOT_FOUND,
        "Chat not found. Make sure chatId, senderId, receiverId are valid",
      );
    }

    const newMessage = await Message.create({
      chatId,
      sender: userId,
      receiver: receiverId,
      message,
    });

    // notify both participants upon new message
    postNotification("New message", message, receiverId);
    postNotification("New message", message, userId);

    // Broadcast to user
    io.to(userId).emit(
      EnumSocketEvent.SEND_MESSAGE,
      emitResult({
        statusCode: status.OK,
        success: true,
        message: "Message sent successfully",
        data: { ...newMessage.toObject() },
      }),
    );

    // Broadcast to receiver
    io.to(receiverId).emit(
      EnumSocketEvent.SEND_MESSAGE,
      emitResult({
        statusCode: status.OK,
        success: true,
        message: "Message sent successfully",
        data: { ...newMessage.toObject() },
      }),
    );

    return newMessage;
  },
);

const ChatSocketController = {
  sendMessage,
};

export = ChatSocketController;
