import { z } from "zod";
import objectId from "../../../util/objectIdSchema";

const postChat = z.object({
  body: z.object({
    receiverId: objectId,
  }),
});

const getChatMessages = z.object({
  query: z.object({
    chatId: objectId,
  }),
});

const updateMessageAsSeen = z.object({
  body: z.object({
    chatId: objectId,
  }),
});

const ChatValidation = {
  postChat,
  getChatMessages,
  updateMessageAsSeen,
};

export = ChatValidation;
