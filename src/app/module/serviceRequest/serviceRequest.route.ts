import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ServiceRequestValidation } from "./serviceRequest.validation.js";
import { ServiceRequestController } from "./serviceRequest.controller.js";
import { multerUpload } from "../../config/multer.config.js";

const router = Router();

// Public / Authenticated Slot Availability Check for a Center
router.get(
    '/centers/:centerId/availability',
    ServiceRequestController.getCenterAvailability
);

// Create service booking (Customer must upload at least one mandatory problem image)
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN), 
    multerUpload.array('problemImages', 5),
    validateRequest(ServiceRequestValidation.createRequest),
    ServiceRequestController.createRequest
);

// Get service requests (Customer, Owner, Admin, Mechanic)
router.get(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN, Role.MECHANIC), 
    ServiceRequestController.getRequests
);

// Assign or reassign mechanic (Owner / Admin)
router.patch(
    '/:id/assign', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    validateRequest(ServiceRequestValidation.assignMechanic),
    ServiceRequestController.assignMechanic
);

// Mechanic starts assigned work
router.patch(
    '/:id/start',
    checkAuth(Role.MECHANIC),
    ServiceRequestController.startWork
);

// Mechanic submits completion with mandatory completion photos
router.patch(
    '/:id/complete',
    checkAuth(Role.MECHANIC),
    multerUpload.array('completionImages', 5),
    ServiceRequestController.submitCompletion
);

// Owner verifies completed work (APPROVE or REWORK)
router.patch(
    '/:id/verify',
    checkAuth(Role.OWNER, Role.ADMIN),
    validateRequest(ServiceRequestValidation.verifyCompletion),
    ServiceRequestController.verifyCompletion
);

// Owner reopens approved job for rework following customer complaint
router.patch(
    '/:id/reopen',
    checkAuth(Role.OWNER, Role.ADMIN),
    validateRequest(ServiceRequestValidation.reopenForRework),
    ServiceRequestController.reopenForRework
);

// General status update
router.patch(
    '/:id/status', 
    checkAuth(Role.OWNER, Role.ADMIN, Role.MECHANIC), 
    validateRequest(ServiceRequestValidation.updateStatus),
    ServiceRequestController.updateStatus
);

export const ServiceRequestRoutes = router;
