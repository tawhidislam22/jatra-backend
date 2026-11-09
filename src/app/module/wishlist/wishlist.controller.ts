import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { WishlistService } from "./wishlist.service.js";

const toggleWishlist = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const userId = (req.user as any).userId;
    const result = await WishlistService.toggleWishlist(userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result
    });
});

const getMyWishlist = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const userId = (req.user as any).userId;
    const result = await WishlistService.getMyWishlist(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Wishlist retrieved successfully.",
        data: result
    });
});

const getMyWishlistIds = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const userId = (req.user as any).userId;
    const result = await WishlistService.getMyWishlistIds(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Wishlist IDs retrieved successfully.",
        data: result
    });
});

const removeWishlistItem = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const userId = (req.user as any).userId;
    const { id } = req.params;
    const result = await WishlistService.removeWishlistItem(userId, id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result
    });
});

export const WishlistController = {
    toggleWishlist,
    getMyWishlist,
    getMyWishlistIds,
    removeWishlistItem,
};
