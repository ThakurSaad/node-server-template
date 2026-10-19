import express from "express";
import auth from "../../middleware/auth";
import config from "../../../config";
import { ChatController } from "./chat.controller";

const router = express.Router();

router
  .post("/post-chat", auth(config.auth_level.user), ChatController.postChat)
  .get(
    "/get-chat-messages",
    auth(config.auth_level.user),
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
    ChatController.updateMessageAsSeen,
  );

export = router;
