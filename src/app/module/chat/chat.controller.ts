import { status } from "../../../util/httpStatus";
import { Request, Response } from "express";
import { ChatService } from "./chat.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";
import ApiError from "../../../error/ApiError";

const postChat = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ChatService.postChat(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Chat initiated",
    data: result,
  });
});

const getChatMessages = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ChatService.getChatMessages(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Chat retrieved",
    data: result,
  });
});

const getAllChats = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ChatService.getAllChats(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Chats retrieved",
    data: result,
  });
});

const updateMessageAsSeen = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }
  const result = await ChatService.updateMessageAsSeen(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Message updated as seen",
    data: result,
  });
});

const ChatController = {
  postChat,
  getChatMessages,
  getAllChats,
  updateMessageAsSeen,
};

export { ChatController };
