import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { NotificationController } from "./notification.controller.js";

const router = Router();

router.get(
  "/",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  NotificationController.getUserNotifications
);

router.patch(
  "/mark-all-read",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  NotificationController.markAllAsRead
);

router.patch(
  "/:id/read",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  NotificationController.markAsRead
);

router.delete(
  "/:id",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  NotificationController.deleteNotification
);

export const NotificationRoutes = router;
