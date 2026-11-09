import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ServiceRequestValidation } from "./serviceRequest.validation.js";
import { ServiceRequestController } from "./serviceRequest.controller.js";

const router = Router();

// Create service request
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN), 
    validateRequest(ServiceRequestValidation.createRequest),
    ServiceRequestController.createRequest
);

// Get service requests
router.get(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN, Role.MECHANIC), 
    ServiceRequestController.getRequests
);

// Assign mechanic
router.patch(
    '/:id/assign', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    validateRequest(ServiceRequestValidation.assignMechanic),
    ServiceRequestController.assignMechanic
);

// Update status
router.patch(
    '/:id/status', 
    checkAuth(Role.OWNER, Role.ADMIN, Role.MECHANIC), 
    validateRequest(ServiceRequestValidation.updateStatus),
    ServiceRequestController.updateStatus
);

export const ServiceRequestRoutes = router;
