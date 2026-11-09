import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { ICreateNotification } from "./notification.interface.js";

const createNotification = async (payload: ICreateNotification) => {
  return await prisma.notification.create({
    data: {
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type || "INFO",
      link: payload.link || null,
      read: false,
    },
  });
};

const getUserNotifications = async (userId: string, filter?: string) => {
  const whereClause: any = { userId };
  if (filter === "unread") {
    whereClause.read = false;
  } else if (filter === "read") {
    whereClause.read = true;
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
  ]);

  return { notifications, unreadCount };
};

const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError(status.NOT_FOUND, "Notification not found.");
  }

  if (notification.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "Not authorized to update this notification.");
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
};

const markAllAsRead = async (userId: string) => {
  return await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
};

const deleteNotification = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError(status.NOT_FOUND, "Notification not found.");
  }

  if (notification.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "Not authorized to delete this notification.");
  }

  return await prisma.notification.delete({
    where: { id: notificationId },
  });
};

export const NotificationService = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
