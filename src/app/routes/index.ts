import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route.js";
import { AutomotiveCenterRoutes } from "../module/automotiveCenter/automotiveCenter.route.js";
import { VehicleRoutes } from "../module/vehicle/vehicle.route.js";
import { RentalBookingRoutes } from "../module/rentalBooking/rentalBooking.route.js";
import { ServiceRequestRoutes } from "../module/serviceRequest/serviceRequest.route.js";
import { EmergencyAssistanceRoutes } from "../module/emergencyAssistance/emergencyAssistance.route.js";
import { ReviewRoutes } from "../module/review/review.route.js";
import { PaymentRoutes } from "../module/payment/payment.route.js";
import { UserRoutes } from "../module/user/user.route.js";

const router = Router();

router.use("/auth", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/automotive-centers", AutomotiveCenterRoutes);
router.use("/vehicles", VehicleRoutes);
router.use("/rental-bookings", RentalBookingRoutes);
router.use("/service-requests", ServiceRequestRoutes);
router.use("/emergencies", EmergencyAssistanceRoutes);
router.use("/reviews", ReviewRoutes);
router.use("/payments", PaymentRoutes);

export const IndexRoutes = router;