import { sendEmail } from "../../utils/email.js";
import { prisma } from "../../lib/prisma.js";

const recordEmailLog = async (recipient: string, subject: string, template: string, dedupKey?: string, rentalBookingId?: string) => {
    try {
        await prisma.emailLog.create({
            data: {
                recipient,
                subject,
                template,
                status: "SENT",
                dedupKey: dedupKey || null,
                rentalBookingId: rentalBookingId || null
            }
        });
    } catch (e: any) {
        console.warn("Could not log email delivery (duplicate or DB error):", e?.message);
    }
};

const sendBookingConfirmation = async (
    booking: any,
    customer: any,
    vehicle: any,
    center?: any
) => {
    const dedupKey = `rental-confirm-${booking.id}`;
    const subject = `Rental Booking Confirmed - ${vehicle?.make || ""} ${vehicle?.model || "Vehicle"}`;
    const pickupStr = new Date(booking.pickupDate).toLocaleDateString();
    const returnStr = new Date(booking.returnDate).toLocaleDateString();

    const templateData = {
        customerName: customer?.fullName || customer?.name || "Valued Customer",
        bookingId: booking.id,
        vehicleName: `${vehicle?.make || ""} ${vehicle?.model || ""} (${vehicle?.year || ""})`,
        pickupDate: pickupStr,
        returnDate: returnStr,
        totalAmount: booking.totalAmount,
        centerName: center?.name || "Jatra Fleet Workshop",
        dashboardLink: `/dashboard/bookings`
    };

    try {
        await sendEmail({
            to: customer.email,
            subject,
            templateName: "bookingConfirmation",
            templateData
        });
        await recordEmailLog(customer.email, subject, "bookingConfirmation", dedupKey, booking.id);
    } catch (err) {
        console.error("Failed to send rental confirmation email to customer:", err);
    }
};

const sendCancellationConfirmation = async (
    booking: any,
    customer: any,
    vehicle: any,
    refundDetails: {
        paidAmount: number;
        cancellationFee: number;
        refundAmount: number;
        feePercentage: number;
    }
) => {
    const dedupKey = `rental-cancel-${booking.id}`;
    const subject = `Rental Booking Cancelled - Refund Processed (#${booking.id.slice(0, 8)})`;

    const templateData = {
        customerName: customer?.fullName || customer?.name || "Customer",
        bookingId: booking.id,
        vehicleName: `${vehicle?.make || ""} ${vehicle?.model || ""}`,
        originalAmount: refundDetails.paidAmount,
        cancellationFee: refundDetails.cancellationFee,
        feePercentage: refundDetails.feePercentage,
        refundAmount: refundDetails.refundAmount,
        walletLink: `/dashboard/wallet`
    };

    try {
        await sendEmail({
            to: customer.email,
            subject,
            templateName: "bookingCancellation",
            templateData
        });
        await recordEmailLog(customer.email, subject, "bookingCancellation", dedupKey, booking.id);
    } catch (err) {
        console.error("Failed to send rental cancellation email to customer:", err);
    }
};

export const RentalBookingEmailService = {
    sendBookingConfirmation,
    sendCancellationConfirmation,
    recordEmailLog
};
