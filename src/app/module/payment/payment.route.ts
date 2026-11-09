import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../constants/prismaEnums";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentValidation } from "./payment.validation";
import { PaymentController } from "./payment.controller";

const router = Router();

// Create a checkout session
router.post(
    '/create-checkout-session', 
    checkAuth(Role.CUSTOMER), 
    validateRequest(PaymentValidation.createCheckoutSession),
    PaymentController.createCheckoutSession
);

// Get payment history
router.get(
    '/history', 
    checkAuth(Role.CUSTOMER), 
    PaymentController.getPaymentHistory
);

// Get all platform payments (Admin only)
router.get(
    '/all',
    checkAuth(Role.ADMIN),
    PaymentController.getAllPayments
);

// Verify payment status (fallback for missing webhook)
router.get(
    '/verify',
    PaymentController.verifyPayment
);

export const PaymentRoutes = router;
