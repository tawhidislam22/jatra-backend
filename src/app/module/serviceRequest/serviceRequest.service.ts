import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role, RequestStatus } from "../../../generated/prisma/browser";
import { ICreateServiceRequest, IUpdateServiceRequestStatus } from "./serviceRequest.interface";

const createRequest = async (userId: string, payload: ICreateServiceRequest) => {
    // Verify vehicle belongs to user if CUSTOMER
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === Role.CUSTOMER) {
        const vehicle = await prisma.vehicle.findUnique({ where: { id: payload.vehicleId } });
        if (!vehicle || vehicle.ownerId !== userId) {
            throw new AppError(status.FORBIDDEN, "Vehicle does not belong to the user.");
        }
    }

    return await prisma.serviceRequest.create({
        data: {
            customerId: userId,
            vehicleId: payload.vehicleId,
            centerId: payload.centerId,
            serviceType: payload.serviceType,
            scheduledDate: payload.scheduledDate,
            issueDescription: payload.issueDescription,
            status: RequestStatus.PENDING
        }
    });
};

const getRequests = async (user: any) => {
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

    return await prisma.serviceRequest.findMany({
        where: whereClause,
        include: { vehicle: true, customer: true, center: true, mechanic: true, payment: true }
    });
};

const assignMechanic = async (id: string, adminId: string, mechanicId: string) => {
    const request = await prisma.serviceRequest.findUnique({ where: { id }, include: { center: true } });
    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    if (request.center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to assign mechanic for this center.");
    }

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
    if (!mechanic || mechanic.employedAtCenterId !== request.centerId) {
        throw new AppError(status.BAD_REQUEST, "Mechanic does not work at this center.");
    }

    return await prisma.serviceRequest.update({
        where: { id },
        data: { mechanicId, status: RequestStatus.ACCEPTED }
    });
};

const updateStatus = async (id: string, user: any, payload: IUpdateServiceRequestStatus) => {
    const request = await prisma.serviceRequest.findUnique({ where: { id }, include: { center: true } });
    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    if (user.role === Role.ADMIN && request.center.adminId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this request.");
    } else if (user.role === Role.MECHANIC && request.mechanicId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not assigned to this request.");
    }

    return await prisma.serviceRequest.update({
        where: { id },
        data: { status: payload.status }
    });
};

export const ServiceRequestService = {
    createRequest,
    getRequests,
    assignMechanic,
    updateStatus
};
