import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role, RequestStatus } from "../../../generated/prisma/browser";
import { IRequestAssistanceRequest, IUpdateEmergencyStatusRequest } from "./emergencyAssistance.interface";

const requestAssistance = async (userId: string, payload: IRequestAssistanceRequest) => {
    return await prisma.emergencyAssistance.create({
        data: {
            customerId: userId,
            centerId: payload.centerId,
            latitude: payload.latitude,
            longitude: payload.longitude,
            issueDescription: payload.issueDescription,
            status: RequestStatus.PENDING
        }
    });
};

const getEmergencies = async (user: any) => {
    let whereClause: any = {};
    if (user.role === Role.CUSTOMER) {
        whereClause.customerId = user.userId;
    } else if (user.role === Role.ADMIN) {
        const center = await prisma.automotiveCenter.findUnique({ where: { adminId: user.userId } });
        if (!center) throw new AppError(status.BAD_REQUEST, "No center managed by user.");
        whereClause.centerId = center.id;
    } else if (user.role === Role.MECHANIC) {
        whereClause.mechanicId = user.userId;
    }

    return await prisma.emergencyAssistance.findMany({
        where: whereClause,
        include: { customer: true, center: true, mechanic: true, payment: true }
    });
};

const assignMechanic = async (id: string, adminId: string, mechanicId: string) => {
    const emergency = await prisma.emergencyAssistance.findUnique({ where: { id }, include: { center: true } });
    if (!emergency) throw new AppError(status.NOT_FOUND, "Emergency request not found.");

    if (emergency.center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to assign mechanic for this center.");
    }

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
    if (!mechanic || mechanic.employedAtCenterId !== emergency.centerId) {
        throw new AppError(status.BAD_REQUEST, "Mechanic does not work at this center.");
    }

    return await prisma.emergencyAssistance.update({
        where: { id },
        data: { mechanicId, status: RequestStatus.ACCEPTED }
    });
};

const updateStatus = async (id: string, user: any, payload: IUpdateEmergencyStatusRequest) => {
    const emergency = await prisma.emergencyAssistance.findUnique({ where: { id }, include: { center: true } });
    if (!emergency) throw new AppError(status.NOT_FOUND, "Emergency request not found.");

    if (user.role === Role.ADMIN && emergency.center.adminId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this request.");
    } else if (user.role === Role.MECHANIC && emergency.mechanicId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not assigned to this request.");
    }

    return await prisma.emergencyAssistance.update({
        where: { id },
        data: { status: payload.status }
    });
};

export const EmergencyAssistanceService = {
    requestAssistance,
    getEmergencies,
    assignMechanic,
    updateStatus
};
