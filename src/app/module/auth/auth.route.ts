import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";

const router = Router();

router.post(
    "/register",
    AuthController.registerUser
);
router.post('/login',AuthController.loginUser)

router.get('/me',
    checkAuth(Role.CUSTOMER,Role.OWNER,Role.MECHANIC),
AuthController.getMe)

router.post('/refresh-token',AuthController.getNewToken)
router.post('/change-password',
    checkAuth(Role.CUSTOMER,Role.OWNER,Role.MECHANIC),
    AuthController.changePassword)
router.post('/logout',
    checkAuth(Role.CUSTOMER,Role.OWNER,Role.MECHANIC),
    AuthController.logoutUser
)

router.post('/verify-email',AuthController.verifyEmail)
router.post('/resend-otp', AuthController.resendOTP)
router.post('/forget-password',AuthController.forgetPassword)
router.post('/reset-password',AuthController.resetPassword)
router.post('/setup-password',AuthController.setupPassword)

router.get('/login/google',AuthController.googleLogin)
router.get('/google/success',AuthController.googleLoginSuccess)
router.get('/google/error',AuthController.handleOAuthError)
export const AuthRoutes = router;
