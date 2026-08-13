import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { PaymentService } from "./payment.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";

const createCheckoutSession = catchAsync(async (req: Request | any, res: Response) => {
    const result = await PaymentService.createCheckoutSession(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Checkout session created successfully",
        data: result
    });
});

const handleStripeWebhookEvent = catchAsync(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    await PaymentService.handleStripeWebhookEvent(req.body, sig);

    res.status(200).send("Webhook received");
});

const getPaymentHistory = catchAsync(async (req: Request | any, res: Response) => {
    const result = await PaymentService.getPaymentHistory(req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Payment history retrieved successfully",
        data: result
    });
});

export const PaymentController = {
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentHistory
};
