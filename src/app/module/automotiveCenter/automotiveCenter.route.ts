import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/browser";
import { validateRequest } from "../../middleware/validateRequest";
import { AutomotiveCenterValidation } from "./automotiveCenter.validation";
import { AutomotiveCenterController } from "./automotiveCenter.controller";
import { multerUpload } from "../../config/multer.config";

const router = Router();

// Register a new automotive center (Any logged in user can register and become an ADMIN)
router.post(
    '/', 
    checkAuth(Role.CUSTOMER, Role.OWNER), 
    multerUpload.single('image'),
    validateRequest(AutomotiveCenterValidation.createCenter),
    AutomotiveCenterController.createCenter
);

// Get all centers
router.get('/', AutomotiveCenterController.getAllCenters);

// Get center by ID
router.get('/:id', AutomotiveCenterController.getCenterById);

// Update center (Only the owning ADMIN)
router.patch(
    '/:id', 
    checkAuth(Role.OWNER), 
    validateRequest(AutomotiveCenterValidation.updateCenter),
    AutomotiveCenterController.updateCenter
);

// Add a mechanic to the center (Only the owning ADMIN)
router.post(
    '/:id/mechanics', 
    checkAuth(Role.OWNER), 
    validateRequest(AutomotiveCenterValidation.addMechanic),
    AutomotiveCenterController.addMechanicToCenter
);

export const AutomotiveCenterRoutes = router;
