import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../constants/prismaEnums";
import { validateRequest } from "../../middleware/validateRequest";
import { RentalBookingValidation } from "./rentalBooking.validation";
import { RentalBookingController } from "./rentalBooking.controller";

const router = Router();

// Create a rental booking (Customer only)
router.post(
    '/', 
    checkAuth(Role.CUSTOMER), 
    validateRequest(RentalBookingValidation.createBooking),
    RentalBookingController.createBooking
);

// Get bookings (Customer sees their own, Admin/Owner sees their center's)
router.get(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN), 
    RentalBookingController.getBookings
);

// Update booking status (Admin/Owner)
router.patch(
    '/:id/status', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    validateRequest(RentalBookingValidation.updateBookingStatus),
    RentalBookingController.updateBookingStatus
);

export const RentalBookingRoutes = router;
