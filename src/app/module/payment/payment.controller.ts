import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { PaymentService } from "./payment.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";

const createCheckoutSession = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await PaymentService.createCheckoutSession(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Checkout session created successfully",
        data: result
    });
});

const handleStripeWebhookEvent = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const sig = req.headers['stripe-signature'] as string;
    await PaymentService.handleStripeWebhookEvent(req.body, sig);

    res.status(200).send("Webhook received");
});

const getPaymentHistory = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await PaymentService.getPaymentHistory(req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Payment history retrieved successfully",
        data: result
    });
});

const verifyPayment = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const sessionId = req.query.session_id as string;
    const result = await PaymentService.verifyPayment(sessionId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: result.success,
        message: result.message,
        data: result
    });
});

const getAllPayments = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await PaymentService.getAllPayments(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "All platform payments retrieved successfully",
        meta: result.meta,
        data: result.data
    });
});

export const PaymentController = {
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentHistory,
    getAllPayments,
    verifyPayment
};
