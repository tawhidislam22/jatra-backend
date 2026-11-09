import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../constants/prismaEnums";
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

// Get all reviews across platform (Admin only)
router.get(
    '/all',
    checkAuth(Role.ADMIN),
    ReviewController.getAllReviews
);

// Delete/moderate a review (Admin only)
router.delete(
    '/:id',
    checkAuth(Role.ADMIN),
    ReviewController.deleteReview
);

export const ReviewRoutes = router;
