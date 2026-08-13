import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";
import { validateRequest } from "../../middleware/validateRequest";
import { VehicleValidation } from "./vehicle.validation";
import { VehicleController } from "./vehicle.controller";

const router = Router();

// Register a vehicle (Customer or Admin)
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.ADMIN), 
    validateRequest(VehicleValidation.registerVehicle),
    VehicleController.registerVehicle
);

// Get all vehicles (Publicly accessible or specific to a role based on future requirements)
router.get('/', VehicleController.getAllVehicles);

// Get my vehicles (Logged in user)
router.get('/my-vehicles', checkAuth(Role.CUSTOMER, Role.ADMIN, Role.MECHANIC), VehicleController.getMyVehicles);

// Update vehicle
router.patch(
    '/:id', 
    checkAuth(Role.CUSTOMER, Role.ADMIN), 
    validateRequest(VehicleValidation.updateVehicle),
    VehicleController.updateVehicle
);

export const VehicleRoutes = router;
