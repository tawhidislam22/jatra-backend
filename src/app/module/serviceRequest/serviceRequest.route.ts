import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";
import { validateRequest } from "../../middleware/validateRequest";
import { ServiceRequestValidation } from "./serviceRequest.validation";
import { ServiceRequestController } from "./serviceRequest.controller";

const router = Router();

// Create service request
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.ADMIN), 
    validateRequest(ServiceRequestValidation.createRequest),
    ServiceRequestController.createRequest
);

// Get service requests
router.get(
    '/', 
    checkAuth(Role.CUSTOMER, Role.ADMIN, Role.MECHANIC), 
    ServiceRequestController.getRequests
);

// Assign mechanic
router.patch(
    '/:id/assign', 
    checkAuth(Role.ADMIN), 
    validateRequest(ServiceRequestValidation.assignMechanic),
    ServiceRequestController.assignMechanic
);

// Update status
router.patch(
    '/:id/status', 
    checkAuth(Role.ADMIN, Role.MECHANIC), 
    validateRequest(ServiceRequestValidation.updateStatus),
    ServiceRequestController.updateStatus
);

export const ServiceRequestRoutes = router;
