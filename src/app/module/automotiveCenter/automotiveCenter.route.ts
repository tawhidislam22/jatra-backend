import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AutomotiveCenterValidation } from "./automotiveCenter.validation.js";
import { AutomotiveCenterController } from "./automotiveCenter.controller.js";
import { multerUpload } from "../../config/multer.config.js";

const router = Router();

// Register a new automotive center (Any logged in user can register and become an OWNER)
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER, Role.ADMIN), 
    multerUpload.single('image'),
    validateRequest(AutomotiveCenterValidation.createCenter),
    AutomotiveCenterController.createCenter
);

// Get all centers
router.get('/', AutomotiveCenterController.getAllCenters);

// Get center by ID
router.get('/:id', AutomotiveCenterController.getCenterById);

// Update center (Only the owning OWNER / ADMIN)
router.patch(
    '/:id', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    multerUpload.single('image'),
    validateRequest(AutomotiveCenterValidation.updateCenter),
    AutomotiveCenterController.updateCenter
);

// Add a mechanic to the center (Only the owning OWNER / ADMIN)
router.post(
    '/:id/mechanics', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    validateRequest(AutomotiveCenterValidation.addMechanic),
    AutomotiveCenterController.addMechanicToCenter
);

// Remove / unassign a mechanic from the center (Only the owning OWNER / ADMIN)
router.delete(
    '/:id/mechanics/:mechanicId', 
    checkAuth(Role.OWNER, Role.ADMIN), 
    AutomotiveCenterController.removeMechanicFromCenter
);

// Verify center approval status (Admin only)
router.patch(
    '/:id/verify', 
    checkAuth(Role.ADMIN), 
    AutomotiveCenterController.verifyCenter
);

// Delete center (Admin only)
router.delete(
    '/:id', 
    checkAuth(Role.ADMIN), 
    AutomotiveCenterController.deleteCenter
);

export const AutomotiveCenterRoutes = router;
