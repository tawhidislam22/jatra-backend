import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import Stripe from "stripe";
import { envVars } from "../../config/env";
import { PaymentStatus } from "../../../generated/prisma/browser";
import { ICreateCheckoutSessionRequest } from "./payment.interface";

const stripe = new Stripe(envVars.STRIPE.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-04-10",
});

const createCheckoutSession = async (userId: string, payload: ICreateCheckoutSessionRequest) => {
    // Basic setup for Stripe session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "Jatra Service Payment",
                    },
                    unit_amount: Math.round(payload.amount * 100),
                },
                quantity: 1,
            },
        ],
        mode: "payment",
        success_url: `${envVars.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${envVars.FRONTEND_URL}/payment/cancel`,
        metadata: {
            userId,
            serviceRequestId: payload.serviceRequestId || null,
            rentalBookingId: payload.rentalBookingId || null,
            emergencyId: payload.emergencyId || null,
        }
    });

    // Create pending payment record
    await prisma.payment.create({
        data: {
            customerId: userId,
            serviceRequestId: payload.serviceRequestId,
            rentalBookingId: payload.rentalBookingId,
            emergencyId: payload.emergencyId,
            amount: payload.amount,
            status: PaymentStatus.PENDING,
            transactionId: session.id
        }
    });

    return { url: session.url };
};

const handleStripeWebhookEvent = async (payload: any, sig: string) => {
    let event;

    try {
        event = stripe.webhooks.constructEvent(payload, sig, envVars.STRIPE.STRIPE_WEBHOOK_SECRET as string);
    } catch (err: any) {
        throw new AppError(status.BAD_REQUEST, `Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        await prisma.payment.updateMany({
            where: { transactionId: session.id },
            data: { status: PaymentStatus.SUCCESS }
        });
    }
};

const getPaymentHistory = async (userId: string) => {
    return await prisma.payment.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' }
    });
};

export const PaymentService = {
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentHistory
};
