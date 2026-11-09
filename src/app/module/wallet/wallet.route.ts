import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.js";
import { Role } from "../../constants/prismaEnums.js";
import { WalletController } from "./wallet.controller.js";

const router = Router();

router.get("/my-wallet", checkAuth(Role.CUSTOMER, Role.OWNER, Role.MECHANIC, Role.ADMIN), WalletController.getMyWallet);

export const WalletRoutes = router;
