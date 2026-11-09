import status from "http-status";
import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { WalletService } from "./wallet.service.js";

const getMyWallet = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const userId = (req.user as any).userId;
    const result = await WalletService.getMyWallet(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Wallet details fetched successfully",
        data: result
    });
});

export const WalletController = {
    getMyWallet
};
