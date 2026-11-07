import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { ReviewService } from "./review.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";

const createReview = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ReviewService.createReview(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Review submitted successfully",
        data: result
    });
});

const getCenterReviews = catchAsync(async (req: Request, res: Response) => {
    const centerId = req.params.centerId as string;
    const result = await ReviewService.getCenterReviews(centerId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Center reviews retrieved successfully",
        data: result
    });
});

const getMyReviews = catchAsync(async (req: Request | any, res: Response) => {
    const userId = req.user.userId;
    const result = await ReviewService.getMyReviews(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Your reviews retrieved successfully",
        data: result
    });
});

const getAllReviews = catchAsync(async (req: Request | any, res: Response) => {
    const result = await ReviewService.getAllReviews();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "All platform reviews retrieved successfully",
        data: result
    });
});

const deleteReview = catchAsync(async (req: Request | any, res: Response) => {
    const { id } = req.params;
    const result = await ReviewService.deleteReview(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Review deleted successfully",
        data: result
    });
});

export const ReviewController = {
    createReview,
    getCenterReviews,
    getMyReviews,
    getAllReviews,
    deleteReview
};
