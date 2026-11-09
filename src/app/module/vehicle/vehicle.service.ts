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

const getAllVehicles = async (query: any) => {
    const vehicleQuery = new QueryBuilder(prisma.vehicle as any, query, {
        searchableFields: ['make', 'model', 'licensePlate'],
        filterableFields: ['type', 'centerId', 'pricePerDay', 'year']
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .fields()
        .include({ center: true, owner: true });

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
    const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        include: { center: true, owner: true }
    });
    if (!vehicle) {
        throw new AppError(status.NOT_FOUND, "Vehicle not found");
    }
    return vehicle;
};

export const VehicleService = {
    registerVehicle,
    getAllVehicles,
    getMyVehicles,
    updateVehicle,
    getVehicleById
};
