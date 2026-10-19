import express from "express";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import config from "../../../config";
import { ChatController } from "./chat.controller";
import ChatValidation from "./chat.validation";

const router = express.Router();

router
  .post(
    "/post-chat",
    auth(config.auth_level.user),
    validateRequest(ChatValidation.postChat),
    ChatController.postChat,
  )
  .get(
    "/get-chat-messages",
    auth(config.auth_level.user),
    validateRequest(ChatValidation.getChatMessages),
    ChatController.getChatMessages,
  )
  .get(
    "/get-all-chats",
    auth(config.auth_level.user),
    ChatController.getAllChats,
  )
  .patch(
    "/update-message-as-seen",
    auth(config.auth_level.user),
    validateRequest(ChatValidation.updateMessageAsSeen),
    ChatController.updateMessageAsSeen,
  );

export = router;
