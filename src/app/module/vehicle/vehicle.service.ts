import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, VehicleType } from "../../constants/prismaEnums.js";
import { IRegisterVehicleRequest, IUpdateVehicleRequest, IVehicleFilterQuery } from "./vehicle.interface.js";

const registerVehicle = async (user: any, payload: IRegisterVehicleRequest) => {
    // If the user is CUSTOMER, they can only register CUSTOMER_OWNED
    if (user.role === Role.CUSTOMER && payload.type !== VehicleType.CUSTOMER_OWNED) {
        throw new AppError(status.FORBIDDEN, "Customers can only register their own vehicles.");
    }
    
    // If the user is OWNER, they register a RENTAL_FLEET vehicle to their center
    let centerId = payload.centerId;
    if (user.role === Role.OWNER && payload.type === VehicleType.RENTAL_FLEET) {
        if (!centerId) {
            const center = await prisma.automotiveCenter.findFirst({ where: { adminId: user.userId } });
            if (!center) throw new AppError(status.BAD_REQUEST, "You don't manage any automotive center.");
            centerId = center.id;
        } else {
            const center = await prisma.automotiveCenter.findUnique({ where: { id: centerId } });
            if (!center || center.adminId !== user.userId) {
                throw new AppError(status.FORBIDDEN, "You do not own this automotive center.");
            }
        }
    }

    return await prisma.vehicle.create({
        data: {
            make: payload.make,
            model: payload.model,
            year: payload.year,
            licensePlate: payload.licensePlate,
            type: payload.type,
            pricePerDay: payload.pricePerDay,
            features: payload.features || [],
            images: payload.images || [],
            ownerId: payload.type === VehicleType.CUSTOMER_OWNED ? user.userId : null,
            centerId: centerId
        }
    });
};

import { QueryBuilder } from "../../utils/QueryBuilder.js";
import { RequestStatus } from "../../constants/prismaEnums.js";
import { RentalBookingService } from "../rentalBooking/rentalBooking.service.js";

const getAllVehicles = async (query: any) => {
    // Proactively sync any bookings whose ending time has passed
    await RentalBookingService.syncExpiredRentalBookings();

    const cleanQuery = { ...query };
    const now = new Date();

    const isAvailableOnly = 
        cleanQuery.availableOnly === 'true' || 
        cleanQuery.availableOnly === true || 
        cleanQuery.isAvailable === 'true' || 
        cleanQuery.isAvailable === true;

    delete cleanQuery.availableOnly;

    // Date range handling
    let pDate: Date | null = null;
    let rDate: Date | null = null;
    if (cleanQuery.pickupDate && cleanQuery.returnDate) {
        const parsedP = new Date(cleanQuery.pickupDate);
        const parsedR = new Date(cleanQuery.returnDate);
        if (!isNaN(parsedP.getTime()) && !isNaN(parsedR.getTime()) && parsedP < parsedR) {
            pDate = parsedP;
            rDate = parsedR;
        }
    }
    delete cleanQuery.pickupDate;
    delete cleanQuery.returnDate;

    // Availability & booked vehicle exclusion logic
    if (isAvailableOnly) {
        cleanQuery.isAvailable = true;

        let conflictingWhere: any;
        if (pDate && rDate) {
            conflictingWhere = {
                status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
                pickupDate: { lt: rDate },
                returnDate: { gt: pDate }
            };
        } else {
            // Available right now: exclude any vehicle currently rented (pickupDate <= now < returnDate)
            conflictingWhere = {
                status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
                pickupDate: { lte: now },
                returnDate: { gt: now }
            };
        }

        const conflicting = await prisma.rentalBooking.findMany({
            where: conflictingWhere,
            select: { vehicleId: true }
        });

        const excludedIds = conflicting.map((c) => c.vehicleId);
        if (excludedIds.length > 0) {
            cleanQuery.id = { notIn: Array.from(new Set(excludedIds)) };
        }
    } else if (pDate && rDate) {
        const conflicting = await prisma.rentalBooking.findMany({
            where: {
                status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
                pickupDate: { lt: rDate },
                returnDate: { gt: pDate }
            },
            select: { vehicleId: true }
        });

        const excludedIds = conflicting.map((c) => c.vehicleId);
        if (excludedIds.length > 0) {
            cleanQuery.id = { notIn: Array.from(new Set(excludedIds)) };
        }
    }

    const vehicleQuery = new QueryBuilder(prisma.vehicle as any, cleanQuery, {
        searchableFields: ['make', 'model', 'licensePlate'],
        filterableFields: ['type', 'centerId', 'pricePerDay', 'year', 'isAvailable', 'id']
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .fields()
        .include({
            center: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    phone: true,
                    rating: true
                }
            },
            owner: {
                select: {
                    id: true,
                    name: true,
                    fullName: true,
                    phone: true
                }
            }
        });

    return await vehicleQuery.execute();
};

const getMyVehicles = async (userId: string) => {
    return await prisma.vehicle.findMany({
        where: { ownerId: userId }
    });
};

const updateVehicle = async (id: string, user: any, payload: IUpdateVehicleRequest) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { center: true } });
    if (!vehicle) throw new AppError(status.NOT_FOUND, "Vehicle not found.");

    // Access control
    if (vehicle.type === VehicleType.CUSTOMER_OWNED && vehicle.ownerId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this vehicle.");
    }
    if (vehicle.type === VehicleType.RENTAL_FLEET && vehicle.center?.adminId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this fleet vehicle.");
    }

    return await prisma.vehicle.update({
        where: { id },
        data: payload
    });
};

const getVehicleById = async (id: string) => {
    await RentalBookingService.syncExpiredRentalBookings();

    const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        include: {
            center: true,
            owner: true,
            rentalBookings: {
                where: {
                    status: { in: [RequestStatus.ACCEPTED, RequestStatus.IN_PROGRESS, RequestStatus.PENDING] },
                    returnDate: { gt: new Date() }
                },
                orderBy: { pickupDate: 'asc' }
            }
        }
    });
    if (!vehicle) {
        throw new AppError(status.NOT_FOUND, "Vehicle not found");
    }

    const now = new Date();
    const currentRental = vehicle.rentalBookings?.find(
        (b) => b.pickupDate <= now && b.returnDate > now
    );

    return {
        ...vehicle,
        isCurrentlyRented: !!currentRental,
        currentRentalEndingTime: currentRental ? currentRental.returnDate : null
    };
};

export const VehicleService = {
    registerVehicle,
    getAllVehicles,
    getMyVehicles,
    updateVehicle,
    getVehicleById
};
