import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";
import { ConversationService } from "./conversation.service.js";

const getUserConversations = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;

  const result = await ConversationService.getUserConversations(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Conversations retrieved successfully",
    data: result,
  });
});

const getConversationMessages = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;
  const conversationId = req.params.id as string;

  const result = await ConversationService.getConversationMessages(userId, conversationId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Messages retrieved successfully",
    data: result,
  });
});

const sendMessage = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;
  const conversationId = req.params.id as string;
  const { content } = req.body;

  const result = await ConversationService.sendMessage(userId, conversationId, content);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const markConversationAsRead = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;
  const conversationId = req.params.id as string;

  const result = await ConversationService.markConversationAsRead(userId, conversationId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Conversation marked as read",
    data: result,
  });
});

export const ConversationController = {
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
};
