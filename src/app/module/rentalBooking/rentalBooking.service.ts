import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role, RequestStatus, VehicleType } from "../../../generated/prisma/browser";
import { ICreateBookingRequest, IUpdateBookingStatusRequest } from "./rentalBooking.interface";

const createBooking = async (userId: string, payload: ICreateBookingRequest) => {
    // Verify vehicle exists and is a rental fleet vehicle
    const vehicle = await prisma.vehicle.findUnique({ where: { id: payload.vehicleId } });
    if (!vehicle) throw new AppError(status.NOT_FOUND, "Vehicle not found.");
    if (vehicle.type !== VehicleType.RENTAL_FLEET) {
        throw new AppError(status.BAD_REQUEST, "Only rental fleet vehicles can be booked.");
    }

    return await prisma.rentalBooking.create({
        data: {
            customerId: userId,
            vehicleId: payload.vehicleId,
            pickupDate: payload.pickupDate,
            returnDate: payload.returnDate,
            totalAmount: payload.totalAmount,
            status: RequestStatus.PENDING
        }
    });
};

const getBookings = async (user: any) => {
    if (user.role === Role.CUSTOMER) {
        // Customer sees their own bookings
        return await prisma.rentalBooking.findMany({
            where: { customerId: user.userId },
            include: { vehicle: true, payment: true }
        });
    } else if (user.role === Role.ADMIN) {
        // Admin sees bookings for their center's vehicles
        const center = await prisma.automotiveCenter.findUnique({ where: { adminId: user.userId } });
        if (!center) throw new AppError(status.BAD_REQUEST, "No center managed by user.");

        return await prisma.rentalBooking.findMany({
            where: {
                vehicle: { centerId: center.id }
            },
            include: { vehicle: true, customer: true, payment: true }
        });
    }
    throw new AppError(status.FORBIDDEN, "Unauthorized");
};

const updateBookingStatus = async (id: string, adminId: string, payload: IUpdateBookingStatusRequest) => {
    const booking = await prisma.rentalBooking.findUnique({
        where: { id },
        include: { vehicle: true }
    });
    
    if (!booking) throw new AppError(status.NOT_FOUND, "Booking not found.");

    // Verify admin owns the center that owns this vehicle
    const center = await prisma.automotiveCenter.findUnique({ where: { adminId } });
    if (!center || center.id !== booking.vehicle.centerId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this booking.");
    }

    return await prisma.rentalBooking.update({
        where: { id },
        data: { status: payload.status }
    });
};

export const RentalBookingService = {
    createBooking,
    getBookings,
    updateBookingStatus
};
