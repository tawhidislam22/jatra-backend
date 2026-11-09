import { Router } from "express";
import { UserController } from "./user.controller";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../constants/prismaEnums";

const router = Router();

// Admin overview analytics
router.get(
    "/admin/overview-stats",
    checkAuth(Role.ADMIN),
    UserController.getAdminOverviewStats
);

// Get all platform users with filtering & pagination
router.get(
    "/",
    checkAuth(Role.ADMIN),
    UserController.getAllUsers
);

// Get single user by ID
router.get(
    "/:id",
    checkAuth(Role.ADMIN),
    UserController.getUserById
);

// Update user role
router.patch(
    "/:id/role",
    checkAuth(Role.ADMIN),
    UserController.updateUserRole
);

// Update user status (Active / Blocked / Suspended)
router.patch(
    "/:id/status",
    checkAuth(Role.ADMIN),
    UserController.updateUserStatus
);

// Delete user
router.delete(
    "/:id",
    checkAuth(Role.ADMIN),
    UserController.deleteUser
);

export const UserRoutes = router;
