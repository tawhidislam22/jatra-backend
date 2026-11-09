import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { WishlistController } from "./wishlist.controller.js";

const router = Router();

// All wishlist routes require authenticated user
router.use(checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN, Role.MECHANIC));

router.post("/toggle", WishlistController.toggleWishlist);
router.get("/my-wishlist", WishlistController.getMyWishlist);
router.get("/my-ids", WishlistController.getMyWishlistIds);
router.delete("/:id", WishlistController.removeWishlistItem);

export const WishlistRoutes = router;
