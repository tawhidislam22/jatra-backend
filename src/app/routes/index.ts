import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route";
import { AutomotiveCenterRoutes } from "../module/automotiveCenter/automotiveCenter.route";
import { VehicleRoutes } from "../module/vehicle/vehicle.route";
import { RentalBookingRoutes } from "../module/rentalBooking/rentalBooking.route";
import { ServiceRequestRoutes } from "../module/serviceRequest/serviceRequest.route";
import { EmergencyAssistanceRoutes } from "../module/emergencyAssistance/emergencyAssistance.route";
import { ReviewRoutes } from "../module/review/review.route";
import { PaymentRoutes } from "../module/payment/payment.route";
import { UserRoutes } from "../module/user/user.route";

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