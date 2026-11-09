import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { RentalBookingValidation } from "./rentalBooking.validation.js";
import { RentalBookingController } from "./rentalBooking.controller.js";

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
