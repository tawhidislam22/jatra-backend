import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { VehicleValidation } from "./vehicle.validation.js";
import { VehicleController } from "./vehicle.controller.js";
import { multerUpload } from "../../config/multer.config.js";

const router = Router();

// Register a vehicle (Customer or Admin)
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER), 
    multerUpload.single('image'),
    validateRequest(VehicleValidation.registerVehicle),
    VehicleController.registerVehicle
);

// Get all vehicles (Publicly accessible or specific to a role based on future requirements)
router.get('/', VehicleController.getAllVehicles);

// Get my vehicles (Logged in user)
router.get('/my-vehicles', checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC), VehicleController.getMyVehicles);

// Get vehicle by id
router.get('/:id', VehicleController.getVehicleById);

// Update vehicle
router.patch(
    '/:id', 
    checkAuth(Role.CUSTOMER, Role.OWNER), 
    multerUpload.single('image'),
    validateRequest(VehicleValidation.updateVehicle),
    VehicleController.updateVehicle
);

export const VehicleRoutes = router;
