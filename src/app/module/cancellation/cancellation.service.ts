import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, RequestStatus, PaymentStatus } from "../../constants/prismaEnums.js";
import { WalletService } from "../wallet/wallet.service.js";
import { NotificationService } from "../notification/notification.service.js";
import { RentalBookingEmailService } from "../rentalBooking/rentalBookingEmail.service.js";

/**
 * Common Tiered Cancellation Policy:
 * >= 72 hours (3+ days): 0% fee -> 100% refund
 * 24 <= hours < 72 (1 to < 3 days): 10% fee -> 90% refund
 * 0 < hours < 24 (< 1 day): 30% fee -> 70% refund
 * <= 0 hours (past start): 100% fee -> 0% refund
 */
const calculateRefund = (startTime: Date, paidAmount: number) => {
    const now = new Date();
    const diffMs = new Date(startTime).getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let feePercentage = 0;
    if (diffHours >= 72) {
        feePercentage = 0;
    } else if (diffHours >= 24) {
        feePercentage = 10;
    } else if (diffHours > 0) {
        feePercentage = 30;
    } else {
        feePercentage = 100; // Past booking start time
    }

    const cancellationFee = Number(((paidAmount * feePercentage) / 100).toFixed(2));
    const refundAmount = Number((paidAmount - cancellationFee).toFixed(2));

    return {
        diffHours,
        feePercentage,
        cancellationFee,
        refundAmount
    };
};

const cancelRentalBooking = async (bookingId: string, user: any, reason?: string) => {
    const booking = await prisma.rentalBooking.findUnique({
        where: { id: bookingId },
        include: {
            vehicle: { include: { center: true } },
            customer: true,
            payment: true
        }
    });

    if (!booking) {
        throw new AppError(status.NOT_FOUND, "Rental booking not found.");
    }

    // Authorization: Customer who booked OR center owner OR admin
    const isCustomer = user.role === Role.CUSTOMER && booking.customerId === user.userId;
    const isOwner = (user.role === Role.OWNER || user.role === Role.ADMIN) && 
        (user.role === Role.ADMIN || booking.vehicle.center?.adminId === user.userId);

    if (!isCustomer && !isOwner) {
        throw new AppError(status.FORBIDDEN, "Not authorized to cancel this booking.");
    }

    if (booking.status === RequestStatus.CANCELLED) {
        throw new AppError(status.BAD_REQUEST, "This booking has already been cancelled.");
    }

    if (booking.status === RequestStatus.COMPLETED || booking.status === RequestStatus.DONE) {
        throw new AppError(status.BAD_REQUEST, "Completed bookings cannot be cancelled.");
    }

    const isPaid = booking.payment?.status === PaymentStatus.SUCCESS;
    const paidAmount = isPaid ? (booking.payment?.amount || booking.totalAmount) : 0;
    const refundCalculation = isPaid ? calculateRefund(booking.pickupDate, paidAmount) : {
        diffHours: 0,
        feePercentage: 0,
        cancellationFee: 0,
        refundAmount: 0
    };

    const cancelledBooking = await prisma.$transaction(async (tx) => {
        let credited = false;

        // Credit customer wallet if paid and refund amount > 0
        if (isPaid && refundCalculation.refundAmount > 0) {
            await WalletService.creditRefund(tx, {
                userId: booking.customerId,
                refundAmount: refundCalculation.refundAmount,
                cancellationFee: refundCalculation.cancellationFee,
                description: `Refund for cancelled rental booking #${booking.id.slice(0, 8)} (${booking.vehicle.make} ${booking.vehicle.model})`,
                rentalBookingId: booking.id
            });
            credited = true;
        }

        // Record cancellation snapshot
        await tx.cancellationRecord.create({
            data: {
                userId: user.userId,
                rentalBookingId: booking.id,
                originalAmount: paidAmount,
                feePercentage: refundCalculation.feePercentage,
                cancellationFee: refundCalculation.cancellationFee,
                refundAmount: refundCalculation.refundAmount,
                refundedToWallet: credited,
                reason: reason || (isCustomer ? "Cancelled by customer" : "Cancelled by workshop owner")
            }
        });

        // Update booking status
        return await tx.rentalBooking.update({
            where: { id: booking.id },
            data: {
                status: RequestStatus.CANCELLED,
                cancellationFee: refundCalculation.cancellationFee,
                refundAmount: refundCalculation.refundAmount,
                cancelledAt: new Date(),
                cancellationReason: reason || null
            },
            include: { vehicle: true, customer: true, payment: true }
        });
    });

    // Notifications & emails outside transaction
    const ownerId = booking.vehicle.center?.adminId;
    const vehicleTitle = `${booking.vehicle.make} ${booking.vehicle.model}`;

    await Promise.allSettled([
        NotificationService.createNotification({
            userId: booking.customerId,
            title: "Rental Booking Cancelled",
            message: `Your booking for ${vehicleTitle} was cancelled. ${refundCalculation.refundAmount > 0 ? `$${refundCalculation.refundAmount} has been credited to your wallet.` : ""}`,
            type: "BOOKING",
            link: "/dashboard/bookings"
        }),
        ownerId ? NotificationService.createNotification({
            userId: ownerId,
            title: "Rental Booking Cancelled",
            message: `Rental booking for ${vehicleTitle} #${booking.id.slice(0, 8)} was cancelled. Dates are now available.`,
            type: "BOOKING",
            link: "/owner/dashboard/bookings"
        }) : Promise.resolve(),
        isPaid ? RentalBookingEmailService.sendCancellationConfirmation(
            booking,
            booking.customer,
            booking.vehicle,
            {
                paidAmount,
                cancellationFee: refundCalculation.cancellationFee,
                refundAmount: refundCalculation.refundAmount,
                feePercentage: refundCalculation.feePercentage
            }
        ) : Promise.resolve()
    ]);

    return {
        booking: cancelledBooking,
        refund: refundCalculation
    };
};

const cancelServiceRequest = async (serviceRequestId: string, user: any, reason?: string) => {
    const serviceRequest = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequestId },
        include: {
            center: true,
            customer: true,
            vehicle: true,
            payment: true
        }
    });

    if (!serviceRequest) {
        throw new AppError(status.NOT_FOUND, "Service request not found.");
    }

    const isCustomer = user.role === Role.CUSTOMER && serviceRequest.customerId === user.userId;
    const isOwner = (user.role === Role.OWNER || user.role === Role.ADMIN) &&
        (user.role === Role.ADMIN || serviceRequest.center.adminId === user.userId);

    if (!isCustomer && !isOwner) {
        throw new AppError(status.FORBIDDEN, "Not authorized to cancel this service request.");
    }

    if (serviceRequest.status === RequestStatus.CANCELLED) {
        throw new AppError(status.BAD_REQUEST, "This service request has already been cancelled.");
    }

    if (serviceRequest.status === RequestStatus.DONE || serviceRequest.status === RequestStatus.COMPLETED) {
        throw new AppError(status.BAD_REQUEST, "Completed service requests cannot be cancelled.");
    }

    const isPaid = serviceRequest.payment?.status === PaymentStatus.SUCCESS;
    const paidAmount = isPaid ? (serviceRequest.payment?.amount || serviceRequest.totalAmount) : 0;
    const refundCalculation = isPaid ? calculateRefund(serviceRequest.scheduledDate, paidAmount) : {
        diffHours: 0,
        feePercentage: 0,
        cancellationFee: 0,
        refundAmount: 0
    };

    const cancelledService = await prisma.$transaction(async (tx) => {
        let credited = false;

        if (isPaid && refundCalculation.refundAmount > 0) {
            await WalletService.creditRefund(tx, {
                userId: serviceRequest.customerId,
                refundAmount: refundCalculation.refundAmount,
                cancellationFee: refundCalculation.cancellationFee,
                description: `Refund for cancelled workshop service #${serviceRequest.id.slice(0, 8)} (${serviceRequest.serviceName || "Service"})`,
                serviceRequestId: serviceRequest.id
            });
            credited = true;
        }

        await tx.cancellationRecord.create({
            data: {
                userId: user.userId,
                serviceRequestId: serviceRequest.id,
                originalAmount: paidAmount,
                feePercentage: refundCalculation.feePercentage,
                cancellationFee: refundCalculation.cancellationFee,
                refundAmount: refundCalculation.refundAmount,
                refundedToWallet: credited,
                reason: reason || (isCustomer ? "Cancelled by customer" : "Cancelled by workshop owner")
            }
        });

        // Release mechanic assignment if assigned
        return await tx.serviceRequest.update({
            where: { id: serviceRequest.id },
            data: {
                status: RequestStatus.CANCELLED,
                mechanicId: null, // Release mechanic
                cancellationFee: refundCalculation.cancellationFee,
                refundAmount: refundCalculation.refundAmount,
                cancelledAt: new Date(),
                cancellationReason: reason || null
            },
            include: { center: true, customer: true, vehicle: true, payment: true }
        });
    });

    // Notify customer and center owner
    await Promise.allSettled([
        NotificationService.createNotification({
            userId: serviceRequest.customerId,
            title: "Service Request Cancelled",
            message: `Your service request for ${serviceRequest.serviceName || "Workshop Service"} was cancelled. ${refundCalculation.refundAmount > 0 ? `$${refundCalculation.refundAmount} refunded to your wallet.` : ""}`,
            type: "SERVICE",
            link: "/dashboard/service-requests"
        }),
        NotificationService.createNotification({
            userId: serviceRequest.center.adminId,
            title: "Service Request Cancelled",
            message: `Service request #${serviceRequest.id.slice(0, 8)} at ${serviceRequest.center.name} has been cancelled. Mechanic and slot released.`,
            type: "SERVICE",
            link: "/owner/dashboard/service-requests"
        })
    ]);

    return {
        serviceRequest: cancelledService,
        refund: refundCalculation
    };
};

export const CancellationService = {
    calculateRefund,
    cancelRentalBooking,
    cancelServiceRequest
};
