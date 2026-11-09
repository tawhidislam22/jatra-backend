import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { EmergencyAssistanceValidation } from "./emergencyAssistance.validation.js";
import { EmergencyAssistanceController } from "./emergencyAssistance.controller.js";

const router = Router();

// Request emergency assistance
router.post(
    '/', 
    checkAuth(Role.CUSTOMER), 
    validateRequest(EmergencyAssistanceValidation.requestAssistance),
    EmergencyAssistanceController.requestAssistance
);

// Get emergencies
router.get(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN, Role.MECHANIC), 
    EmergencyAssistanceController.getEmergencies
);

// Assign mechanic
router.patch(
    '/:id/assign', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    validateRequest(EmergencyAssistanceValidation.assignMechanic),
    EmergencyAssistanceController.assignMechanic
);

// Update status
router.patch(
    '/:id/status', 
    checkAuth(Role.OWNER, Role.ADMIN, Role.MECHANIC), 
    validateRequest(EmergencyAssistanceValidation.updateStatus),
    EmergencyAssistanceController.updateStatus
);

export const EmergencyAssistanceRoutes = router;
