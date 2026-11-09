import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { ConversationController } from "./conversation.controller.js";

const router = Router();

router.get(
  "/",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  ConversationController.getUserConversations
);

router.get(
  "/:id/messages",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  ConversationController.getConversationMessages
);

router.post(
  "/:id/messages",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  ConversationController.sendMessage
);

router.patch(
  "/:id/read",
  checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN),
  ConversationController.markConversationAsRead
);

export const ConversationRoutes = router;
