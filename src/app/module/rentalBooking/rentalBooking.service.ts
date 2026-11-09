import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, RequestStatus, VehicleType } from "../../constants/prismaEnums.js";
import { ICreateBookingRequest, IUpdateBookingStatusRequest } from "./rentalBooking.interface.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { NotificationService } from "../notification/notification.service.js";

const createBooking = async (userId: string, payload: ICreateBookingRequest) => {
    // Verify vehicle exists and is a rental fleet vehicle
    const vehicle = await prisma.vehicle.findUnique({ 
        where: { id: payload.vehicleId },
        include: { center: true }
    });
    if (!vehicle) throw new AppError(status.NOT_FOUND, "Vehicle not found.");
    if (vehicle.type !== VehicleType.RENTAL_FLEET) {
        throw new AppError(status.BAD_REQUEST, "Only rental fleet vehicles can be booked.");
    }

    const booking = await prisma.rentalBooking.create({
        data: {
            customerId: userId,
            vehicleId: payload.vehicleId,
            pickupDate: payload.pickupDate,
            returnDate: payload.returnDate,
            totalAmount: payload.totalAmount,
            status: RequestStatus.PENDING
        }
    });

    // Auto-create/find conversation with vehicle owner/center
    const customer = await prisma.user.findUnique({ where: { id: userId } });
    const ownerId = vehicle.center?.adminId || vehicle.ownerId;
    const vehicleTitle = `${vehicle.make} ${vehicle.model}`;

    if (ownerId && ownerId !== userId) {
        await ConversationService.createOrGetBookingConversation(
            userId,
            ownerId,
            vehicle.centerId || undefined,
            booking.id,
            vehicleTitle,
            booking.pickupDate,
            booking.returnDate
        );

        // Notifications
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
                message: `Your booking request for ${vehicleTitle} has been submitted to ${vehicle.center?.name || "the host"}.`,
                type: "BOOKING",
                link: `/dashboard/bookings`
            })
        ]);
    }

    return booking;
};

const getBookings = async (user: any) => {
    if (user.role === Role.CUSTOMER) {
        // Customer sees their own bookings
        return await prisma.rentalBooking.findMany({
            where: { customerId: user.userId },
            include: { vehicle: true, payment: true }
        });
    } else if (user.role === Role.OWNER || user.role === Role.ADMIN) {
        // Admin/Owner sees bookings for their centers' vehicles
        const centers = await prisma.automotiveCenter.findMany({ where: { adminId: user.userId } });
        if (centers.length === 0) {
            if (user.role === Role.ADMIN) {
                return await prisma.rentalBooking.findMany({
                    include: { vehicle: true, customer: true, payment: true }
                });
            }
            return [];
        }

        return await prisma.rentalBooking.findMany({
            where: {
                vehicle: { centerId: { in: centers.map(c => c.id) } }
            },
            include: { vehicle: true, customer: true, payment: true }
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
    if (adminUser?.role !== Role.ADMIN && !centers.some(c => c.id === booking.vehicle.centerId)) {
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
        message: `Your rental booking for ${booking.vehicle?.make || ''} ${booking.vehicle?.model || ''} is now ${payload.status}.`,
        type: "BOOKING",
        link: `/dashboard/bookings`
    });

    return updated;
};

export const RentalBookingService = {
    createBooking,
    getBookings,
    updateBookingStatus
};
