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
    const { centerId } = req.params;
    const result = await ReviewService.getCenterReviews(centerId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Reviews retrieved successfully",
        data: result
    });
});

export const ReviewController = {
    createReview,
    getCenterReviews
};
