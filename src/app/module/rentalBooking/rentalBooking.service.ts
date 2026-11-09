import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, RequestStatus, VehicleType } from "../../constants/prismaEnums.js";
import { ICreateBookingRequest, IUpdateBookingStatusRequest, ICancelBookingRequest } from "./rentalBooking.interface.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { NotificationService } from "../notification/notification.service.js";
import { CancellationService } from "../cancellation/cancellation.service.js";

/**
 * Checks if a vehicle is available for the given date range [pickupDate, returnDate)
 * Overlap formula: existingPickup < newReturn && existingReturn > newPickup
 * Cancelled bookings do NOT block availability.
 */
const checkVehicleAvailability = async (
    vehicleId: string,
    pickupDate: Date,
    returnDate: Date,
    excludeBookingId?: string
) => {
    const conflicting = await prisma.rentalBooking.findFirst({
        where: {
            vehicleId,
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
            pickupDate: { lt: returnDate },
            returnDate: { gt: pickupDate }
        }
    });

    return !conflicting;
};

/**
 * Returns all active booked date ranges for a vehicle (for frontend calendar rendering)
 */
const getVehicleAvailability = async (vehicleId: string) => {
    const activeBookings = await prisma.rentalBooking.findMany({
        where: {
            vehicleId,
            status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] }
        },
        select: {
            id: true,
            pickupDate: true,
            returnDate: true,
            status: true
        },
        orderBy: { pickupDate: "asc" }
    });

    return activeBookings;
};

const createBooking = async (userId: string, payload: ICreateBookingRequest) => {
    const pickupDate = new Date(payload.pickupDate);
    const returnDate = new Date(payload.returnDate);

    if (isNaN(pickupDate.getTime()) || isNaN(returnDate.getTime())) {
        throw new AppError(status.BAD_REQUEST, "Invalid pickup or return date.");
    }

    if (pickupDate >= returnDate) {
        throw new AppError(status.BAD_REQUEST, "Return date must be strictly after pickup date.");
    }

    // 1. Enforce critical business rule: "at a time one user multiple car rent korte parbe nah"
    const activeCustomerBooking = await prisma.rentalBooking.findFirst({
        where: {
            customerId: userId,
            status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
            pickupDate: { lt: returnDate },
            returnDate: { gt: pickupDate }
        },
        include: { vehicle: true }
    });

    if (activeCustomerBooking) {
        throw new AppError(
            status.CONFLICT,
            `You already have an active rental booking (${activeCustomerBooking.vehicle.make} ${activeCustomerBooking.vehicle.model}) during this period. One user cannot rent multiple vehicles simultaneously.`
        );
    }

    // 2. Atomic concurrency-protected booking creation
    const booking = await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({
            where: { id: payload.vehicleId },
            include: { center: true }
        });

        if (!vehicle) {
            throw new AppError(status.NOT_FOUND, "Vehicle not found.");
        }

        if (vehicle.type !== VehicleType.RENTAL_FLEET) {
            throw new AppError(status.BAD_REQUEST, "Only rental fleet vehicles can be booked.");
        }

        if (vehicle.isAvailable === false) {
            throw new AppError(status.BAD_REQUEST, "This vehicle is currently deactivated for rental.");
        }

        if (!vehicle.pricePerDay || vehicle.pricePerDay <= 0) {
            throw new AppError(status.BAD_REQUEST, "Vehicle daily rental price is not configured.");
        }

        // Check date range conflict on the vehicle
        const conflictingBooking = await tx.rentalBooking.findFirst({
            where: {
                vehicleId: payload.vehicleId,
                status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
                pickupDate: { lt: returnDate },
                returnDate: { gt: pickupDate }
            }
        });

        if (conflictingBooking) {
            throw new AppError(
                status.CONFLICT,
                "This vehicle is already reserved for the selected dates. Please choose different dates."
            );
        }

        // Calculate days & snapshot total price
        const diffTime = returnDate.getTime() - pickupDate.getTime();
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const calculatedTotal = Number((diffDays * vehicle.pricePerDay).toFixed(2));

        return await tx.rentalBooking.create({
            data: {
                customerId: userId,
                vehicleId: payload.vehicleId,
                pickupDate,
                returnDate,
                totalAmount: calculatedTotal,
                dailyPriceSnapshot: vehicle.pricePerDay, // Snapshot price!
                status: RequestStatus.PENDING
            },
            include: {
                vehicle: { include: { center: true } },
                customer: true
            }
        });
    });

    // Auto-create/find conversation with vehicle owner/center
    const customer = booking.customer;
    const vehicle = booking.vehicle;
    const ownerId = vehicle.center?.adminId || vehicle.ownerId;
    const vehicleTitle = `${vehicle.make} ${vehicle.model}`;

    if (ownerId && ownerId !== userId) {
        try {
            await ConversationService.createOrGetBookingConversation(
                userId,
                ownerId,
                vehicle.centerId || undefined,
                booking.id,
                vehicleTitle,
                booking.pickupDate,
                booking.returnDate
            );

            await Promise.all([
                NotificationService.createNotification({
                    userId: ownerId,
                    title: "New Rental Booking",
                    message: `${customer?.fullName || customer?.name || "Customer"} booked ${vehicleTitle}. Check your bookings and messages.`,
                    type: "BOOKING",
                    link: `/owner/dashboard/bookings`
                }),
                NotificationService.createNotification({
                    userId,
                    title: "Booking Submitted",
                    message: `Your booking request for ${vehicleTitle} has been submitted. Complete payment to confirm.`,
                    type: "BOOKING",
                    link: `/dashboard/bookings`
                })
            ]);
        } catch (convErr) {
            console.error("Failed to provision conversation/notification for booking:", convErr);
        }
    }

    return booking;
};

const getBookings = async (user: any) => {
    if (user.role === Role.CUSTOMER) {
        return await prisma.rentalBooking.findMany({
            where: { customerId: user.userId },
            include: {
                vehicle: { include: { center: true } },
                payment: true,
                cancellationRecord: true
            },
            orderBy: { pickupDate: "desc" }
        });
    } else if (user.role === Role.OWNER || user.role === Role.ADMIN) {
        const centers = await prisma.automotiveCenter.findMany({ where: { adminId: user.userId } });
        if (centers.length === 0) {
            if (user.role === Role.ADMIN) {
                return await prisma.rentalBooking.findMany({
                    include: {
                        vehicle: { include: { center: true } },
                        customer: true,
                        payment: true,
                        cancellationRecord: true
                    },
                    orderBy: { pickupDate: "desc" }
                });
            }
            return [];
        }

        return await prisma.rentalBooking.findMany({
            where: {
                vehicle: { centerId: { in: centers.map((c) => c.id) } }
            },
            include: {
                vehicle: { include: { center: true } },
                customer: true,
                payment: true,
                cancellationRecord: true
            },
            orderBy: { pickupDate: "desc" }
        });
    }
    return [];
};

const updateBookingStatus = async (id: string, adminId: string, payload: IUpdateBookingStatusRequest) => {
    const booking = await prisma.rentalBooking.findUnique({
        where: { id },
        include: { vehicle: true }
    });

    if (!booking) throw new AppError(status.NOT_FOUND, "Booking not found.");

    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    const centers = await prisma.automotiveCenter.findMany({ where: { adminId } });
    if (adminUser?.role !== Role.ADMIN && !centers.some((c) => c.id === booking.vehicle.centerId)) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this booking.");
    }

    const updated = await prisma.rentalBooking.update({
        where: { id },
        data: { status: payload.status }
    });

    // Notify customer
    await NotificationService.createNotification({
        userId: booking.customerId,
        title: `Rental Booking ${payload.status}`,
        message: `Your rental booking for ${booking.vehicle?.make || ""} ${booking.vehicle?.model || ""} is now ${payload.status}.`,
        type: "BOOKING",
        link: `/dashboard/bookings`
    });

    return updated;
};

const cancelBooking = async (id: string, user: any, payload: ICancelBookingRequest) => {
    return await CancellationService.cancelRentalBooking(id, user, payload.reason);
};

export const RentalBookingService = {
    checkVehicleAvailability,
    getVehicleAvailability,
    createBooking,
    getBookings,
    updateBookingStatus,
    cancelBooking
};
