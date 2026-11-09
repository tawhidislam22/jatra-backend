import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, RequestStatus } from "../../constants/prismaEnums.js";
import { ICreateServiceRequest, IUpdateServiceRequestStatus } from "./serviceRequest.interface.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { NotificationService } from "../notification/notification.service.js";

const createRequest = async (userId: string, payload: ICreateServiceRequest) => {
    // Verify vehicle belongs to user if CUSTOMER
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === Role.CUSTOMER) {
        const vehicle = await prisma.vehicle.findUnique({ where: { id: payload.vehicleId } });
        if (!vehicle || vehicle.ownerId !== userId) {
            throw new AppError(status.FORBIDDEN, "Vehicle does not belong to the user.");
        }
    }

    const request = await prisma.serviceRequest.create({
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

    // Auto-create/find conversation with center owner
    const center = await prisma.automotiveCenter.findUnique({ where: { id: payload.centerId } });
    const customer = await prisma.user.findUnique({ where: { id: userId } });

    if (center?.adminId && center.adminId !== userId) {
        await ConversationService.createOrGetServiceConversation(
            userId,
            center.adminId,
            payload.centerId,
            request.id,
            payload.serviceType,
            payload.issueDescription,
            request.scheduledDate
        );

        // Notifications
        await Promise.all([
            NotificationService.createNotification({
                userId: center.adminId,
                title: "New Service Request",
                message: `${customer?.fullName || customer?.name || "Customer"} requested ${payload.serviceType} at ${center.name}.`,
                type: "SERVICE",
                link: `/owner/dashboard/service-requests`
            }),
            NotificationService.createNotification({
                userId,
                title: "Service Request Submitted",
                message: `Your ${payload.serviceType} service request has been sent to ${center.name}.`,
                type: "SERVICE",
                link: `/dashboard/service-requests`
            })
        ]);
    }

    return request;
};

const getRequests = async (user: any) => {
    let whereClause: any = {};
    if (user.role === Role.CUSTOMER) {
        whereClause.customerId = user.userId;
    } else if (user.role === Role.OWNER || user.role === Role.ADMIN) {
        const centers = await prisma.automotiveCenter.findMany({ where: { adminId: user.userId } });
        if (centers.length === 0) {
            if (user.role === Role.ADMIN) {
                return await prisma.serviceRequest.findMany({
                    where: {},
                    include: { vehicle: true, customer: true, center: true, mechanic: true, payment: true }
                });
            }
            return [];
        }
        whereClause.centerId = { in: centers.map(c => c.id) };
    } else if (user.role === Role.MECHANIC) {
        const dbMechanic = await prisma.user.findUnique({ where: { id: user.userId } });
        if (dbMechanic?.employedAtCenterId) {
            whereClause = {
                OR: [
                    { mechanicId: user.userId },
                    { centerId: dbMechanic.employedAtCenterId }
                ]
            };
        } else {
            whereClause.mechanicId = user.userId;
        }
    }

    return await prisma.serviceRequest.findMany({
        where: whereClause,
        include: { vehicle: true, customer: true, center: true, mechanic: true, payment: true }
    });
};

const assignMechanic = async (id: string, adminId: string, mechanicId: string) => {
    const request = await prisma.serviceRequest.findUnique({ where: { id }, include: { center: true } });
    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (adminUser?.role !== Role.ADMIN && request.center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to assign mechanic for this center.");
    }

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
    if (!mechanic || mechanic.employedAtCenterId !== request.centerId) {
        throw new AppError(status.BAD_REQUEST, "Mechanic does not work at this center.");
    }

    const updated = await prisma.serviceRequest.update({
        where: { id },
        data: { mechanicId, status: RequestStatus.ACCEPTED }
    });

    // Notify mechanic
    await NotificationService.createNotification({
        userId: mechanicId,
        title: "Service Job Assigned",
        message: `You have been assigned to service request #${id.slice(0, 8)} at ${request.center.name}.`,
        type: "SERVICE",
        link: `/mechanic/dashboard/assigned-services`
    });

    return updated;
};

const updateStatus = async (id: string, user: any, payload: IUpdateServiceRequestStatus) => {
    const request = await prisma.serviceRequest.findUnique({ where: { id }, include: { center: true } });
    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    if ((user.role === Role.OWNER || user.role === Role.ADMIN) && user.role !== Role.ADMIN && request.center.adminId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to update this request.");
    } else if (user.role === Role.MECHANIC && request.mechanicId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Not assigned to this request.");
    }

    const updated = await prisma.serviceRequest.update({
        where: { id },
        data: { status: payload.status }
    });

    // Notify customer
    await NotificationService.createNotification({
        userId: request.customerId,
        title: `Service Request ${payload.status}`,
        message: `Your service request at ${request.center.name} is now ${payload.status}.`,
        type: "SERVICE",
        link: `/dashboard/service-requests`
    });

    return updated;
};

export const ServiceRequestService = {
    createRequest,
    getRequests,
    assignMechanic,
    updateStatus
};
