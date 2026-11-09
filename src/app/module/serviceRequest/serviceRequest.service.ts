import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, RequestStatus, ServiceType } from "../../constants/prismaEnums.js";
import { 
    ICreateServiceRequest, 
    IUpdateServiceRequestStatus, 
    ISubmitCompletion, 
    IVerifyCompletion, 
    IReopenForRework,
    ICenterSlotAvailability 
} from "./serviceRequest.interface.js";
import { ConversationService } from "../conversation/conversation.service.js";
import { NotificationService } from "../notification/notification.service.js";
import { ServiceRequestEmailService } from "./serviceRequestEmail.service.js";
import { getServiceByNameOrId, WORKSHOP_SERVICES } from "../../constants/serviceCatalog.js";

// Helper: check time overlap between two intervals [A_start, A_end] and [B_start, B_end]
const isTimeOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date): boolean => {
    return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
};

/**
 * Phase 2: Dynamic Multi-Mechanic Availability Calculator
 * Calculates available hourly slots (09:00 - 18:00) for a given center and date
 */
const getCenterAvailability = async (centerId: string, dateStr: string, durationMinutes = 60) => {
    const center = await prisma.automotiveCenter.findUnique({
        where: { id: centerId },
        include: {
            mechanics: {
                where: {
                    status: "ACTIVE",
                    isAvailable: true,
                    isDeleted: false
                }
            }
        }
    });

    if (!center) {
        throw new AppError(status.NOT_FOUND, "Automotive center not found.");
    }

    const totalMechanics = center.mechanics.length;

    // Day boundaries
    const targetDate = new Date(dateStr);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    // Active bookings for the day (excluding CANCELLED and stale unconfirmed PENDING)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const activeBookings = await prisma.serviceRequest.findMany({
        where: {
            centerId,
            scheduledDate: {
                gte: dayStart,
                lte: dayEnd
            },
            OR: [
                {
                    status: {
                        in: [
                            RequestStatus.ACCEPTED,
                            RequestStatus.IN_PROGRESS,
                            RequestStatus.COMPLETED_PENDING_REVIEW,
                            RequestStatus.REASSIGNMENT_REQUIRED
                        ]
                    }
                },
                {
                    // Provisional pending bookings from the last 30 mins
                    status: RequestStatus.PENDING,
                    scheduledDate: {
                        gte: thirtyMinutesAgo
                    }
                }
            ]
        }
    });

    const standardHours = [
        "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
    ];

    const slots: ICenterSlotAvailability[] = standardHours.map(timeStr => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const slotStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes, 0);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        // Count overlapping bookings for this slot
        const overlappingCount = activeBookings.filter(b => {
            const bookingStart = new Date(b.scheduledDate);
            const bookingDuration = b.estimatedDuration || 60;
            const bookingEnd = new Date(bookingStart.getTime() + bookingDuration * 60 * 1000);
            return isTimeOverlapping(slotStart, slotEnd, bookingStart, bookingEnd);
        }).length;

        const availableMechanicsCount = Math.max(0, totalMechanics - overlappingCount);
        const available = totalMechanics > 0 && availableMechanicsCount > 0;

        let reason: string | undefined = undefined;
        if (totalMechanics === 0) {
            reason = "No active mechanics at this center";
        } else if (availableMechanicsCount === 0) {
            reason = "Fully booked for this time slot";
        }

        return {
            time: timeStr,
            available,
            availableMechanicsCount,
            totalMechanicsCount: totalMechanics,
            reason
        };
    });

    return {
        centerId,
        date: dateStr,
        estimatedDuration: durationMinutes,
        totalMechanicsCount: totalMechanics,
        isCenterBookable: totalMechanics > 0 && slots.some(s => s.available),
        slots
    };
};

/**
 * Phase 1 & 2: Concurrency-Protected Booking Creation with Mandatory Problem Images
 */
const createRequest = async (userId: string, payload: ICreateServiceRequest, problemImages: string[]) => {
    // 1. Mandatory Problem Image Validation
    if (!problemImages || problemImages.length === 0) {
        throw new AppError(status.BAD_REQUEST, "At least one problem photo showing the car issue is mandatory.");
    }

    // 2. Validate Vehicle
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === Role.CUSTOMER) {
        const vehicle = await prisma.vehicle.findUnique({ where: { id: payload.vehicleId } });
        if (!vehicle || (vehicle.ownerId && vehicle.ownerId !== userId)) {
            throw new AppError(status.FORBIDDEN, "Selected vehicle does not belong to your account.");
        }
    }

    // 2.1 Prevent multiple active service bookings for the same car at a time
    const activeBookingForCar = await prisma.serviceRequest.findFirst({
        where: {
            vehicleId: payload.vehicleId,
            status: {
                in: [
                    RequestStatus.PENDING,
                    RequestStatus.ACCEPTED,
                    RequestStatus.IN_PROGRESS,
                    RequestStatus.COMPLETED_PENDING_REVIEW,
                    RequestStatus.REASSIGNMENT_REQUIRED
                ]
            }
        },
        include: {
            center: { select: { name: true } },
            payment: { select: { status: true } }
        }
    });

    if (activeBookingForCar) {
        const isFailedPending = activeBookingForCar.status === RequestStatus.PENDING && activeBookingForCar.payment?.status === PaymentStatus.FAILED;
        if (!isFailedPending) {
            throw new AppError(
                status.CONFLICT,
                `This car already has an ongoing service booking in progress (${activeBookingForCar.serviceName || 'Car Service'} - Status: ${activeBookingForCar.status.replace(/_/g, ' ')}${activeBookingForCar.center?.name ? ` at ${activeBookingForCar.center.name}` : ''}). You cannot create multiple service bookings for the same vehicle simultaneously.`
            );
        }
    }

    // 3. Resolve Service Package & Price
    let serviceName = payload.serviceName || "Workshop Car Service";
    let estimatedDuration = Number(payload.estimatedDuration) || 60;
    let totalAmount = Number(payload.totalAmount) || 50;

    const centerRecord = await prisma.automotiveCenter.findUnique({ where: { id: payload.centerId } });
    if (centerRecord?.customServices && Array.isArray(centerRecord.customServices)) {
        const customPkg = (centerRecord.customServices as any[]).find((s: any) =>
            s.name?.toLowerCase() === payload.serviceName?.toLowerCase() ||
            s.id === payload.serviceName
        );
        if (customPkg) {
            serviceName = customPkg.name || serviceName;
            estimatedDuration = Number(customPkg.estimatedDuration) || estimatedDuration;
            totalAmount = Number(customPkg.price) || totalAmount;
        }
    } else {
        const catalogService = getServiceByNameOrId(payload.serviceName || "");
        if (catalogService) {
            serviceName = catalogService.name;
            estimatedDuration = payload.estimatedDuration || catalogService.estimatedDuration;
            totalAmount = payload.totalAmount || catalogService.price;
        }
    }

    const scheduledDate = new Date(payload.scheduledDate);
    const bookingEnd = new Date(scheduledDate.getTime() + estimatedDuration * 60 * 1000);

    // 4. Concurrency Protection with Prisma Transaction
    const booking = await prisma.$transaction(async (tx) => {
        // Query active mechanics at center
        const center = await tx.automotiveCenter.findUnique({
            where: { id: payload.centerId },
            include: {
                mechanics: {
                    where: {
                        status: "ACTIVE",
                        isAvailable: true,
                        isDeleted: false
                    }
                }
            }
        });

        if (!center) {
            throw new AppError(status.NOT_FOUND, "Service center not found.");
        }

        if (center.mechanics.length === 0) {
            throw new AppError(status.BAD_REQUEST, "This service center currently has no active mechanics available.");
        }

        // Count overlapping confirmed/active bookings in this slot
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const overlapping = await tx.serviceRequest.findMany({
            where: {
                centerId: payload.centerId,
                scheduledDate: {
                    gte: new Date(scheduledDate.getTime() - 4 * 60 * 60 * 1000), // Check 4-hour window
                    lte: new Date(bookingEnd.getTime() + 4 * 60 * 60 * 1000)
                },
                OR: [
                    {
                        status: {
                            in: [
                                RequestStatus.ACCEPTED,
                                RequestStatus.IN_PROGRESS,
                                RequestStatus.COMPLETED_PENDING_REVIEW,
                                RequestStatus.REASSIGNMENT_REQUIRED
                            ]
                        }
                    },
                    {
                        status: RequestStatus.PENDING,
                        scheduledDate: { gte: thirtyMinsAgo }
                    }
                ]
            }
        });

        const activeOverlappingCount = overlapping.filter(b => {
            const bStart = new Date(b.scheduledDate);
            const bDuration = b.estimatedDuration || 60;
            const bEnd = new Date(bStart.getTime() + bDuration * 60 * 1000);
            return isTimeOverlapping(scheduledDate, bookingEnd, bStart, bEnd);
        }).length;

        if (activeOverlappingCount >= center.mechanics.length) {
            throw new AppError(
                status.CONFLICT,
                "All mechanics are fully booked during this time slot. Please choose another date or time."
            );
        }

        // Create provisional booking (status: PENDING until payment verification)
        return await tx.serviceRequest.create({
            data: {
                customerId: userId,
                vehicleId: payload.vehicleId,
                centerId: payload.centerId,
                serviceType: payload.serviceType || ServiceType.WORKSHOP,
                serviceName,
                scheduledDate,
                issueDescription: payload.issueDescription || null,
                problemImages,
                completionImages: [],
                estimatedDuration,
                totalAmount,
                status: RequestStatus.PENDING
            },
            include: {
                center: true,
                vehicle: true,
                customer: true
            }
        });
    });

    // 5. Auto-provision conversation thread with owner
    if (booking.center?.adminId && booking.center.adminId !== userId) {
        await ConversationService.createOrGetServiceConversation(
            userId,
            booking.center.adminId,
            payload.centerId,
            booking.id,
            booking.serviceName || "Workshop Service",
            booking.issueDescription || "",
            booking.scheduledDate
        );
    }

    return booking;
};

/**
 * Get service requests with role-based filtering
 */
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
                    include: {
                        vehicle: true,
                        customer: true,
                        center: true,
                        mechanic: true,
                        payment: true,
                        review: true,
                        assignmentHistory: {
                            include: { mechanic: true, assignedBy: true },
                            orderBy: { assignedAt: "desc" }
                        }
                    },
                    orderBy: { scheduledDate: "desc" }
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
                    { centerId: dbMechanic.employedAtCenterId, mechanicId: null }
                ]
            };
        } else {
            whereClause.mechanicId = user.userId;
        }
    }

    return await prisma.serviceRequest.findMany({
        where: whereClause,
        include: {
            vehicle: true,
            customer: true,
            center: true,
            mechanic: true,
            payment: true,
            review: true,
            assignmentHistory: {
                include: { mechanic: true, assignedBy: true },
                orderBy: { assignedAt: "desc" }
            }
        },
        orderBy: { scheduledDate: "desc" }
    });
};

/**
 * Phase 4: Owner Assigns or Reassigns Mechanic
 */
const assignMechanic = async (id: string, adminId: string, mechanicId: string, notes?: string) => {
    const request = await prisma.serviceRequest.findUnique({
        where: { id },
        include: { center: true, customer: true, vehicle: true, mechanic: true }
    });
    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (adminUser?.role !== Role.ADMIN && request.center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to manage assignments for this center.");
    }

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
    if (!mechanic || mechanic.employedAtCenterId !== request.centerId) {
        throw new AppError(status.BAD_REQUEST, "Selected mechanic is not an active member of this workshop center.");
    }

    const isReassignment = Boolean(request.mechanicId && request.mechanicId !== mechanicId);
    const previousMechanicId = request.mechanicId;

    const updated = await prisma.$transaction(async (tx) => {
        // Record assignment history
        await tx.serviceAssignmentHistory.create({
            data: {
                serviceRequestId: id,
                mechanicId,
                assignedById: adminId,
                status: isReassignment ? "REASSIGNED" : "ASSIGNED",
                notes: notes || (isReassignment ? "Reassigned by workshop manager" : "Assigned by workshop manager")
            }
        });

        return await tx.serviceRequest.update({
            where: { id },
            data: {
                mechanicId,
                status: RequestStatus.ACCEPTED
            },
            include: { center: true, customer: true, vehicle: true, mechanic: true }
        });
    });

    // In-app notifications
    await Promise.all([
        NotificationService.createNotification({
            userId: mechanicId,
            title: isReassignment ? "Job Reassigned To You" : "New Service Job Assigned",
            message: `You have been assigned to service request #${id.slice(0, 8)} (${updated.serviceName}) at ${request.center.name}.`,
            type: "SERVICE",
            link: `/mechanic/dashboard/assigned-services`
        }),
        NotificationService.createNotification({
            userId: request.customerId,
            title: "Mechanic Assigned",
            message: `${mechanic.fullName || mechanic.name} has been assigned to your ${updated.serviceName} at ${request.center.name}.`,
            type: "SERVICE",
            link: `/dashboard/service-requests`
        })
    ]);

    // Notify previous mechanic if reassigned
    if (isReassignment && previousMechanicId) {
        await NotificationService.createNotification({
            userId: previousMechanicId,
            title: "Job Reassigned",
            message: `Job #${id.slice(0, 8)} has been reassigned to another mechanic by the workshop manager.`,
            type: "SERVICE",
            link: `/mechanic/dashboard/assigned-services`
        });
    }

    // Email to mechanic
    await ServiceRequestEmailService.sendMechanicAssigned(
        updated,
        mechanic,
        request.customer,
        request.center,
        request.vehicle
    );

    return updated;
};

/**
 * Phase 5: Mechanic Starts Work
 */
const startWork = async (id: string, mechanicId: string) => {
    const request = await prisma.serviceRequest.findUnique({
        where: { id },
        include: { center: true, customer: true, vehicle: true }
    });
    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    if (request.mechanicId !== mechanicId) {
        throw new AppError(status.FORBIDDEN, "You are not the assigned mechanic for this job.");
    }

    const updated = await prisma.$transaction(async (tx) => {
        await tx.serviceAssignmentHistory.create({
            data: {
                serviceRequestId: id,
                mechanicId,
                assignedById: mechanicId,
                status: "STARTED",
                notes: "Repair work started by mechanic"
            }
        });

        return await tx.serviceRequest.update({
            where: { id },
            data: { status: RequestStatus.IN_PROGRESS }
        });
    });

    // In-app notifications
    await Promise.all([
        NotificationService.createNotification({
            userId: request.customerId,
            title: "Repair Work Started",
            message: `The mechanic has started working on your ${request.serviceName || "vehicle"} at ${request.center.name}.`,
            type: "SERVICE",
            link: `/dashboard/service-requests`
        }),
        NotificationService.createNotification({
            userId: request.center.adminId,
            title: "Job In Progress",
            message: `Job #${id.slice(0, 8)} has been moved to In Progress.`,
            type: "SERVICE",
            link: `/owner/dashboard/service-requests`
        })
    ]);

    return updated;
};

/**
 * Phase 5: Mechanic Submits Completed Work with Mandatory Completion Photos
 */
const submitCompletion = async (id: string, mechanicId: string, payload: ISubmitCompletion) => {
    if (!payload.completionImages || payload.completionImages.length === 0) {
        throw new AppError(status.BAD_REQUEST, "At least one completion photo is mandatory to verify finished work.");
    }

    const request = await prisma.serviceRequest.findUnique({
        where: { id },
        include: {
            center: { include: { admin: true } },
            customer: true,
            vehicle: true,
            mechanic: true
        }
    });

    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    if (request.mechanicId !== mechanicId) {
        throw new AppError(status.FORBIDDEN, "You are not authorized to submit completion for this request.");
    }

    const updated = await prisma.$transaction(async (tx) => {
        // Log assignment history
        await tx.serviceAssignmentHistory.create({
            data: {
                serviceRequestId: id,
                mechanicId,
                assignedById: mechanicId,
                status: "COMPLETED_PENDING_REVIEW",
                notes: payload.notes || "Work completed and photos submitted by mechanic"
            }
        });

        return await tx.serviceRequest.update({
            where: { id },
            data: {
                status: RequestStatus.COMPLETED_PENDING_REVIEW,
                completionImages: payload.completionImages
            },
            include: { center: true, customer: true, vehicle: true, mechanic: true }
        });
    });

    // Notify Owner for review
    await NotificationService.createNotification({
        userId: request.center.adminId,
        title: "Work Completed - Approval Needed",
        message: `${request.mechanic?.fullName || request.mechanic?.name || "Mechanic"} completed ${request.serviceName} for Job #${id.slice(0, 8)}. Please review completion photos.`,
        type: "SERVICE",
        link: `/owner/dashboard/service-requests`
    });

    // Notify Customer
    await NotificationService.createNotification({
        userId: request.customerId,
        title: "Service Completed - Quality Check Underway",
        message: `Your ${request.serviceName} has been finished and is undergoing quality verification by the workshop manager.`,
        type: "SERVICE",
        link: `/dashboard/service-requests`
    });

    // Email to Owner
    await ServiceRequestEmailService.sendWorkCompletedForReview(
        updated,
        request.center.admin,
        request.mechanic,
        request.customer,
        request.vehicle
    );

    return updated;
};

/**
 * Phase 6: Owner Completion Verification (Approve or Request Rework)
 */
const verifyCompletion = async (id: string, adminId: string, payload: IVerifyCompletion) => {
    const request = await prisma.serviceRequest.findUnique({
        where: { id },
        include: { center: true, customer: true, vehicle: true, mechanic: true }
    });

    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (adminUser?.role !== Role.ADMIN && request.center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to verify work for this center.");
    }

    if (payload.action === "APPROVE") {
        const updated = await prisma.$transaction(async (tx) => {
            await tx.serviceAssignmentHistory.create({
                data: {
                    serviceRequestId: id,
                    mechanicId: request.mechanicId || adminId,
                    assignedById: adminId,
                    status: "APPROVED",
                    notes: payload.notes || "Work inspected and approved by workshop manager"
                }
            });

            return await tx.serviceRequest.update({
                where: { id },
                data: {
                    status: RequestStatus.DONE,
                    approvedAt: new Date()
                },
                include: { center: true, customer: true, vehicle: true, mechanic: true }
            });
        });

        // Notifications
        await Promise.all([
            NotificationService.createNotification({
                userId: request.customerId,
                title: "Service Approved & Ready!",
                message: `Your ${request.serviceName} at ${request.center.name} has been verified and approved. Your car is ready!`,
                type: "SERVICE",
                link: `/dashboard/service-requests`
            }),
            request.mechanicId ? NotificationService.createNotification({
                userId: request.mechanicId,
                title: "Job Approved",
                message: `Your completed work on Job #${id.slice(0, 8)} was approved by the manager.`,
                type: "SERVICE",
                link: `/mechanic/dashboard/assigned-services`
            }) : Promise.resolve()
        ]);

        // Email Customer
        await ServiceRequestEmailService.sendServiceApproved(
            updated,
            request.customer,
            request.center,
            request.vehicle
        );

        return updated;
    } else if (payload.action === "REWORK") {
        const reworkNotes = payload.notes || "Manager requested rework to meet safety standards";
        const assignedMechanicId = payload.newMechanicId || request.mechanicId;

        const updated = await prisma.$transaction(async (tx) => {
            await tx.serviceAssignmentHistory.create({
                data: {
                    serviceRequestId: id,
                    mechanicId: assignedMechanicId || adminId,
                    assignedById: adminId,
                    status: "REWORK_REQUESTED",
                    notes: reworkNotes
                }
            });

            return await tx.serviceRequest.update({
                where: { id },
                data: {
                    status: RequestStatus.REASSIGNMENT_REQUIRED,
                    reworkNotes,
                    mechanicId: assignedMechanicId
                },
                include: { center: true, customer: true, vehicle: true, mechanic: true }
            });
        });

        // Notifications
        await Promise.all([
            NotificationService.createNotification({
                userId: request.customerId,
                title: "Service Quality Adjustment",
                message: `Workshop inspection requested additional tuning on your ${request.serviceName}. We are finalizing the service.`,
                type: "SERVICE",
                link: `/dashboard/service-requests`
            }),
            assignedMechanicId ? NotificationService.createNotification({
                userId: assignedMechanicId,
                title: "Rework Requested",
                message: `Manager requested rework on Job #${id.slice(0, 8)}: ${reworkNotes}`,
                type: "SERVICE",
                link: `/mechanic/dashboard/assigned-services`
            }) : Promise.resolve()
        ]);

        // Email Customer & Mechanic
        await ServiceRequestEmailService.sendReworkNotice(
            request.customer.email,
            request.customer.fullName || request.customer.name || "Customer",
            updated,
            request.center,
            request.vehicle,
            reworkNotes
        );

        return updated;
    } else {
        throw new AppError(status.BAD_REQUEST, "Invalid action. Must be 'APPROVE' or 'REWORK'.");
    }
};

/**
 * Phase 6 & 7: Owner Reopens Job after negative customer review/complaint
 */
const reopenForRework = async (id: string, adminId: string, payload: IReopenForRework) => {
    const request = await prisma.serviceRequest.findUnique({
        where: { id },
        include: { center: true, customer: true, vehicle: true }
    });

    if (!request) throw new AppError(status.NOT_FOUND, "Service request not found.");

    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (adminUser?.role !== Role.ADMIN && request.center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to manage this center.");
    }

    const assignedMechanicId = payload.mechanicId || request.mechanicId;

    const updated = await prisma.$transaction(async (tx) => {
        await tx.serviceAssignmentHistory.create({
            data: {
                serviceRequestId: id,
                mechanicId: assignedMechanicId || adminId,
                assignedById: adminId,
                status: "REOPENED_FOR_REWORK",
                notes: payload.reason
            }
        });

        return await tx.serviceRequest.update({
            where: { id },
            data: {
                status: RequestStatus.REASSIGNMENT_REQUIRED,
                reworkNotes: payload.reason,
                mechanicId: assignedMechanicId
            },
            include: { center: true, customer: true, vehicle: true, mechanic: true }
        });
    });

    // Notify customer
    await NotificationService.createNotification({
        userId: request.customerId,
        title: "Booking Reopened for Rework",
        message: `Your complaint regarding Job #${id.slice(0, 8)} was investigated by ${request.center.name}. Rework has been initiated.`,
        type: "SERVICE",
        link: `/dashboard/service-requests`
    });

    return updated;
};

/**
 * Update request status (General)
 */
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
    getCenterAvailability,
    createRequest,
    getRequests,
    assignMechanic,
    startWork,
    submitCompletion,
    verifyCompletion,
    reopenForRework,
    updateStatus
};
