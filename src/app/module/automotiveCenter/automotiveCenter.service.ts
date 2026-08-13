import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role } from "../../../generated/prisma/browser";
import { ICreateCenterRequest, IUpdateCenterRequest } from "./automotiveCenter.interface";

const createCenter = async (userId: string, payload: ICreateCenterRequest) => {
    // Check if user is already an admin of a center
    const existingCenter = await prisma.automotiveCenter.findUnique({
        where: { adminId: userId }
    });
    if (existingCenter) {
        throw new AppError(status.BAD_REQUEST, "User already manages an automotive center.");
    }

    const result = await prisma.$transaction(async (tx) => {
        const center = await tx.automotiveCenter.create({
            data: {
                ...payload,
                adminId: userId
            }
        });
        
        // Ensure user has ADMIN role
        await tx.user.update({
            where: { id: userId },
            data: { role: Role.ADMIN }
        });

        return center;
    });

    return result;
};

const getAllCenters = async () => {
    return await prisma.automotiveCenter.findMany({
        include: { admin: true }
    });
};

const getCenterById = async (id: string) => {
    const center = await prisma.automotiveCenter.findUnique({
        where: { id },
        include: { mechanics: true, rentalFleet: true, reviews: true }
    });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");
    return center;
};

const updateCenter = async (id: string, adminId: string, payload: IUpdateCenterRequest) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");
    if (center.adminId !== adminId) throw new AppError(status.FORBIDDEN, "You are not authorized to update this center.");

    return await prisma.automotiveCenter.update({
        where: { id },
        data: payload
    });
};

const addMechanicToCenter = async (centerId: string, adminId: string, mechanicId: string) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");
    if (center.adminId !== adminId) throw new AppError(status.FORBIDDEN, "You are not authorized to update this center.");

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
    if (!mechanic || mechanic.role !== Role.MECHANIC) {
        throw new AppError(status.BAD_REQUEST, "Invalid mechanic ID or user is not a mechanic.");
    }

    return await prisma.user.update({
        where: { id: mechanicId },
        data: { employedAtCenterId: centerId }
    });
};

export const AutomotiveCenterService = {
    createCenter,
    getAllCenters,
    getCenterById,
    updateCenter,
    addMechanicToCenter
};
