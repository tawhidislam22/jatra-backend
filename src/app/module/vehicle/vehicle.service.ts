import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role, VehicleType } from "../../../generated/prisma/browser";
import { IRegisterVehicleRequest, IUpdateVehicleRequest, IVehicleFilterQuery } from "./vehicle.interface";

const registerVehicle = async (user: any, payload: IRegisterVehicleRequest) => {
    // If the user is CUSTOMER, they can only register CUSTOMER_OWNED
    if (user.role === Role.CUSTOMER && payload.type !== VehicleType.CUSTOMER_OWNED) {
        throw new AppError(status.FORBIDDEN, "Customers can only register their own vehicles.");
    }
    
    // If the user is ADMIN, they register a RENTAL_FLEET vehicle to their center
    let centerId = payload.centerId;
    if (user.role === Role.ADMIN && payload.type === VehicleType.RENTAL_FLEET) {
        const center = await prisma.automotiveCenter.findUnique({ where: { adminId: user.userId } });
        if (!center) throw new AppError(status.BAD_REQUEST, "You don't manage any automotive center.");
        centerId = center.id;
    }

    return await prisma.vehicle.create({
        data: {
            make: payload.make,
            model: payload.model,
            year: payload.year,
            licensePlate: payload.licensePlate,
            type: payload.type,
            ownerId: payload.type === VehicleType.CUSTOMER_OWNED ? user.userId : null,
            centerId: centerId
        }
    });
};

const getAllVehicles = async (query: IVehicleFilterQuery) => {
    // Support filtering by type (e.g. RENTAL_FLEET) or centerId
    const { type, centerId } = query;
    const filter: any = {};
    if (type) filter.type = type;
    if (centerId) filter.centerId = centerId;

    return await prisma.vehicle.findMany({
        where: filter,
        include: { center: true, owner: true }
    });
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

export const VehicleService = {
    registerVehicle,
    getAllVehicles,
    getMyVehicles,
    updateVehicle
};
