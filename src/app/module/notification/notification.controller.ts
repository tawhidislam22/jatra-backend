import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";
import { NotificationService } from "./notification.service.js";

const getUserNotifications = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;
  const filter = req.query.filter as string | undefined;

  const result = await NotificationService.getUserNotifications(userId, filter);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Notifications retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;
  const id = req.params.id as string;

  const result = await NotificationService.markAsRead(userId, id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;

  const result = await NotificationService.markAllAsRead(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userId = req.user.userId;
  const id = req.params.id as string;

  const result = await NotificationService.deleteNotification(userId, id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Notification deleted successfully",
    data: result,
  });
});

export const NotificationController = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
