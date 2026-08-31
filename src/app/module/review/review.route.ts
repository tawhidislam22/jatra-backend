import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";
import { validateRequest } from "../../middleware/validateRequest";
import { ReviewValidation } from "./review.validation";
import { ReviewController } from "./review.controller";

const router = Router();

// Submit a review
router.post(
    '/', 
    checkAuth(Role.CUSTOMER), 
    validateRequest(ReviewValidation.createReview),
    ReviewController.createReview
);

// Get reviews for a center
router.get(
    '/center/:centerId', 
    ReviewController.getCenterReviews
);

// Get my reviews
router.get(
    '/my-reviews',
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC),
    ReviewController.getMyReviews
);

export const ReviewRoutes = router;
