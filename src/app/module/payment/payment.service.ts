import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import Stripe from "stripe";
import { envVars } from "../../config/env.js";
import { PaymentStatus } from "../../constants/prismaEnums.js";
import { ICreateCheckoutSessionRequest } from "./payment.interface.js";

let stripeClient: Stripe | null = null;

const getStripe = () => {
    if (!envVars.STRIPE.STRIPE_SECRET_KEY) {
        throw new AppError(status.INTERNAL_SERVER_ERROR, "Stripe secret key is not configured.");
    }

    if (!stripeClient) {
        stripeClient = new Stripe(envVars.STRIPE.STRIPE_SECRET_KEY, {
            apiVersion: "2026-06-24.dahlia" as any,
        });
    }

    return stripeClient;
};

const createCheckoutSession = async (userId: string, payload: ICreateCheckoutSessionRequest) => {
    const metadata: Record<string, string> = { userId };
    if (payload.serviceRequestId) metadata.serviceRequestId = String(payload.serviceRequestId);
    if (payload.rentalBookingId) metadata.rentalBookingId = String(payload.rentalBookingId);

    // Basic setup for Stripe session
    const stripe = getStripe();
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
        metadata,
    });

    // Create pending payment record
    await prisma.payment.create({
        data: {
            userId: userId,
            serviceRequestId: payload.serviceRequestId,
            rentalBookingId: payload.rentalBookingId,
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
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(payload, sig, envVars.STRIPE.STRIPE_WEBHOOK_SECRET as string);
    } catch (err: any) {
        throw new AppError(status.BAD_REQUEST, `Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillCheckoutSession(session.id);
    }
};

const fulfillCheckoutSession = async (sessionId: string) => {
    // Check if it's already fulfilled
    const existing = await prisma.payment.findUnique({
        where: { transactionId: sessionId }
    });
    if (existing?.status === PaymentStatus.SUCCESS) return; // Already processed

    await prisma.payment.updateMany({
        where: { transactionId: sessionId },
        data: { status: PaymentStatus.SUCCESS, paidAt: new Date() }
    });

    const payment = await prisma.payment.findUnique({
        where: { transactionId: sessionId },
        include: { user: true }
    });

    if (payment) {
        // Update Rental Booking if applicable
        if (payment.rentalBookingId) {
            await prisma.rentalBooking.update({
                where: { id: payment.rentalBookingId },
                data: { status: 'ACCEPTED' as any }
            });
        }
        // Update Service Request if applicable
        if (payment.serviceRequestId) {
            const updatedService = await prisma.serviceRequest.update({
                where: { id: payment.serviceRequestId },
                data: { status: 'ACCEPTED' as any },
                include: { center: true, customer: true, vehicle: true }
            });

            if (updatedService) {
                try {
                    const { ServiceRequestEmailService } = await import("../serviceRequest/serviceRequestEmail.service.js");
                    const { NotificationService } = await import("../notification/notification.service.js");

                    // Customer notification
                    await NotificationService.createNotification({
                        userId: updatedService.customerId,
                        title: "Booking Confirmed & Paid",
                        message: `Your booking for ${updatedService.serviceName || "Car Service"} at ${updatedService.center.name} is confirmed.`,
                        type: "SERVICE",
                        link: "/dashboard/service-requests"
                    });

                    // Owner notification
                    await NotificationService.createNotification({
                        userId: updatedService.center.adminId,
                        title: "New Confirmed Booking",
                        message: `${updatedService.customer.fullName || updatedService.customer.name} booked ${updatedService.serviceName || "Car Service"} for ${new Date(updatedService.scheduledDate).toLocaleDateString()}. Please assign a mechanic.`,
                        type: "SERVICE",
                        link: "/owner/dashboard/service-requests"
                    });

                    // Email to customer
                    await ServiceRequestEmailService.sendBookingConfirmation(
                        updatedService,
                        updatedService.customer,
                        updatedService.center,
                        updatedService.vehicle
                    );
                } catch (confirmErr) {
                    console.error("Failed to send confirmation notifications/email for service request:", confirmErr);
                }
            }
        }

        // Send Invoice Email (swallow error so it doesn't crash the fulfillment if SMTP is misconfigured)
        try {
            const { sendEmail } = await import("../../utils/email.js");
            const { generateInvoicePdf } = await import("../../utils/pdfGenerator.js");
            const invoiceNumber = `INV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            
            const templateData = {
                customerName: payment.user.name,
                invoiceId: invoiceNumber,
                transactionId: payment.transactionId,
                paymentDate: new Date().toLocaleDateString(),
                serviceName: payment.rentalBookingId ? "Vehicle Rental" : "Automotive Service",
                bookingDate: new Date().toLocaleDateString(),
                amount: payment.amount,
                invoiceUrl: ""
            };

            const pdfBuffer = await generateInvoicePdf(templateData);

            await sendEmail({
                to: payment.user.email,
                subject: `Payment Receipt & Invoice ${invoiceNumber}`,
                templateName: "invoice",
                templateData,
                attachments: [
                    {
                        filename: `Invoice_${invoiceNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            });
        } catch (error) {
            console.error("Failed to send invoice email during fulfillment:", error);
        }
    }
};

const verifyPayment = async (sessionId: string) => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
        await fulfillCheckoutSession(sessionId);
        return { success: true, message: "Payment verified and fulfilled" };
    }
    return { success: false, message: "Payment not completed" };
};

const getPaymentHistory = async (userId: string) => {
    return await prisma.payment.findMany({
        where: { userId },
        orderBy: { paidAt: 'desc' }
    });
};

const getAllPayments = async (query?: any) => {
    const { status: paymentStatus, page = 1, limit = 50 } = query || {};
    const whereClause: any = {};
    if (paymentStatus) {
        whereClause.status = paymentStatus;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [payments, total] = await Promise.all([
        prisma.payment.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: { paidAt: 'desc' },
            include: {
                user: {
                    select: { id: true, name: true, fullName: true, email: true, phone: true }
                },
                serviceRequest: {
                    include: { center: true, vehicle: true }
                },
                rentalBooking: {
                    include: { vehicle: true }
                }
            }
        }),
        prisma.payment.count({ where: whereClause })
    ]);

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
        },
        data: payments
    };
};

export const PaymentService = {
    createCheckoutSession,
    handleStripeWebhookEvent,
    getPaymentHistory,
    getAllPayments,
    verifyPayment
};
