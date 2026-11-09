/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, UserStatus, RequestStatus } from "../../constants/prismaEnums.js";
import { auth } from "../../lib/auth.js";
import { ICreateCenterRequest, IUpdateCenterRequest } from "./automotiveCenter.interface.js";
import { sendEmail } from "../../utils/email.js";
import { envVars } from "../../config/env.js";

const createCenter = async (userId: string, payload: ICreateCenterRequest) => {
    const result = await prisma.$transaction(async (tx) => {
        const center = await tx.automotiveCenter.create({
            data: {
                ...payload,
                adminId: userId
            }
        });
        
        // Ensure user has OWNER role
        await tx.user.update({
            where: { id: userId },
            data: { role: Role.OWNER }
        });

        return center;
    });

    return result;
};

const getAllCenters = async (query: any) => {
    const isPublic = !query.adminId && query.forAdmin !== 'true' && query.all !== 'true';
    const whereConditions: any = {};

    if (isPublic) {
        whereConditions.isApproved = true;
        // Public route: ONLY show centers that currently have at least one active, non-deleted, available mechanic
        whereConditions.mechanics = {
            some: {
                status: UserStatus.ACTIVE,
                isDeleted: false,
                isAvailable: true
            }
        };
    } else if (query.adminId) {
        whereConditions.adminId = query.adminId;
    }

    if (query.isApproved !== undefined) {
        whereConditions.isApproved = query.isApproved === 'true' || query.isApproved === true;
    }

    if (query.searchTerm) {
        whereConditions.OR = [
            { name: { contains: query.searchTerm, mode: 'insensitive' } },
            { address: { contains: query.searchTerm, mode: 'insensitive' } }
        ];
    }

    if (query.rating) {
        whereConditions.rating = { gte: Number(query.rating) };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || 'rating';
    const sortOrder = query.sortOrder || 'desc';

    const [centers, totalCount] = await Promise.all([
        prisma.automotiveCenter.findMany({
            where: whereConditions,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
                admin: {
                    select: {
                        id: true,
                        name: true,
                        fullName: true,
                        phone: true,
                        email: true
                    }
                },
                mechanics: {
                    where: {
                        status: UserStatus.ACTIVE,
                        isDeleted: false,
                        isAvailable: true
                    },
                    select: {
                        id: true,
                        name: true,
                        fullName: true,
                        isAvailable: true
                    }
                }
            }
        }),
        prisma.automotiveCenter.count({ where: whereConditions })
    ]);

    if (isPublic) {
        const todayStr = (query.date as string) || new Date().toISOString().split("T")[0];
        const targetDate = new Date(todayStr);
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
        const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

        const centerIds = centers.map(c => c.id);
        const activeBookings = await prisma.serviceRequest.findMany({
            where: {
                centerId: { in: centerIds },
                scheduledDate: { gte: dayStart, lte: dayEnd },
                status: {
                    in: [
                        RequestStatus.ACCEPTED,
                        RequestStatus.IN_PROGRESS,
                        RequestStatus.COMPLETED_PENDING_REVIEW,
                        RequestStatus.REASSIGNMENT_REQUIRED,
                        RequestStatus.PENDING
                    ]
                }
            },
            select: {
                centerId: true,
                scheduledDate: true,
                estimatedDuration: true
            }
        });

        // Group bookings by centerId in-memory for instant slot calculation
        const bookingsByCenter = new Map<string, typeof activeBookings>();
        for (const booking of activeBookings) {
            const list = bookingsByCenter.get(booking.centerId) || [];
            list.push(booking);
            bookingsByCenter.set(booking.centerId, list);
        }

        const standardSlots = [
            "09:00", "10:00", "11:00", "12:00", "13:00",
            "14:00", "15:00", "16:00", "17:00", "18:00"
        ];

        const populatedCenters = centers.map((center) => {
            const totalMechanics = center.mechanics ? center.mechanics.length : 0;
            const centerBookings = bookingsByCenter.get(center.id) || [];

            const slotOccupancy: Record<string, number> = {};
            for (const time of standardSlots) {
                slotOccupancy[time] = 0;
            }

            for (const booking of centerBookings) {
                const bookingTime = new Date(booking.scheduledDate);
                const durationMins = booking.estimatedDuration || 60;
                const bookingStartMins = bookingTime.getHours() * 60 + bookingTime.getMinutes();
                const bookingEndMins = bookingStartMins + durationMins;

                for (const timeStr of standardSlots) {
                    const [h, m] = timeStr.split(":").map(Number);
                    const slotMins = h * 60 + m;
                    if (slotMins >= bookingStartMins && slotMins < bookingEndMins) {
                        slotOccupancy[timeStr] = (slotOccupancy[timeStr] || 0) + 1;
                    }
                }
            }

            const openSlots = standardSlots.filter(t => totalMechanics === 0 || (slotOccupancy[t] || 0) < totalMechanics);
            if (openSlots.length === 0 && totalMechanics > 0) {
                return null;
            }

            return {
                ...center,
                totalMechanicsCount: totalMechanics,
                freeSlotsCount: openSlots.length,
                nextFreeSlot: openSlots[0] || null,
                availableSlots: openSlots
            };
        });

        const availableOnly = populatedCenters.filter(Boolean);

        return {
            meta: {
                page,
                limit,
                total: availableOnly.length,
                totalPages: Math.ceil(availableOnly.length / limit) || 1
            },
            data: availableOnly
        };
    }

    return {
        meta: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1
        },
        data: centers
    };
};

const getCenterById = async (id: string) => {
    if (!id || typeof id !== 'string' || id.trim() === '' || id === 'undefined' || id === 'null') {
        throw new AppError(status.NOT_FOUND, "Automotive Center not found.");
    }
    const center = await prisma.automotiveCenter.findUnique({
        where: { id },
        include: {
            mechanics: {
                where: {
                    status: UserStatus.ACTIVE,
                    isDeleted: false
                },
                select: {
                    id: true,
                    name: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    isAvailable: true,
                    status: true
                }
            },
            rentalFleet: {
                where: { isAvailable: true },
                select: {
                    id: true,
                    make: true,
                    model: true,
                    year: true,
                    type: true,
                    pricePerDay: true,
                    images: true,
                    isAvailable: true
                }
            },
            reviews: {
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            fullName: true,
                            image: true
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                take: 10
            },
            admin: {
                select: {
                    id: true,
                    name: true,
                    fullName: true,
                    email: true,
                    phone: true
                }
            }
        }
    });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");

    try {
        const { ServiceRequestService } = await import("../serviceRequest/serviceRequest.service.js");
        const todayStr = new Date().toISOString().split("T")[0];
        const avail = await ServiceRequestService.getCenterAvailability(center.id, todayStr);
        const openSlots = avail.slots.filter(s => s.available);
        return {
            ...center,
            totalMechanicsCount: avail.totalMechanicsCount,
            freeSlotsCount: openSlots.length,
            nextFreeSlot: openSlots[0]?.time || null,
            availableSlots: openSlots.map(s => s.time)
        };
    } catch {
        return center;
    }
};

const updateCenter = async (id: string, adminId: string, payload: IUpdateCenterRequest) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");

    const user = await prisma.user.findUnique({ where: { id: adminId } });
    if (user?.role !== Role.ADMIN && center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "You are not authorized to update this center.");
    }

    return await prisma.automotiveCenter.update({
        where: { id },
        data: payload
    });
};

const addMechanicToCenter = async (centerId: string, adminId: string, payload: any) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");

    const user = await prisma.user.findUnique({ where: { id: adminId } });
    if (user?.role !== Role.ADMIN && center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "You are not authorized to update this center.");
    }

    const { mechanicId, name, fullName, email, password } = payload || {};

    // 1. Assign existing mechanic by ID
    if (mechanicId) {
        const mechanic = await prisma.user.findUnique({
            where: { id: mechanicId },
            include: { employedAtCenter: true }
        });
        if (!mechanic) {
            throw new AppError(status.NOT_FOUND, "Mechanic user not found.");
        }
        if (mechanic.employedAtCenterId === centerId) {
            throw new AppError(status.BAD_REQUEST, "Mechanic is already assigned to this center.");
        }
        if (mechanic.employedAtCenterId && mechanic.employedAtCenterId !== centerId) {
            const currentCenterName = mechanic.employedAtCenter?.name || "another workshop center";
            throw new AppError(
                status.CONFLICT,
                `This mechanic is already assigned to "${currentCenterName}". A mechanic cannot be assigned to multiple centers simultaneously.`
            );
        }
        const updatedMechanic = await prisma.user.update({
            where: { id: mechanicId },
            data: {
                role: Role.MECHANIC,
                employedAtCenterId: centerId,
                isAvailable: true,
                status: UserStatus.ACTIVE
            }
        });

        // Send email notification if mechanic has email
        if (mechanic.email) {
            const resetUrl = `${envVars.FRONTEND_URL}/set-password?email=${encodeURIComponent(mechanic.email)}`;
            try {
                await sendEmail({
                    to: mechanic.email,
                    subject: `Welcome to ${center.name} - Assigned as Mechanic`,
                    templateName: "mechanicInvite",
                    templateData: {
                        name: mechanic.fullName || mechanic.name || "Mechanic",
                        centerName: center.name,
                        email: mechanic.email,
                        password: "(Use your existing account password)",
                        resetUrl
                    }
                });
            } catch (err) {
                console.error("Failed to send mechanic assignment email:", err);
            }
        }

        return updatedMechanic;
    }

    // 2. Create or link mechanic by email
    if (email) {
        const mechanicName = fullName || name || "Mechanic";
        const mechanicPassword = password || "Mechanic@123";
        const resetUrl = `${envVars.FRONTEND_URL}/set-password?email=${encodeURIComponent(email)}&temp=${encodeURIComponent(mechanicPassword)}`;

        const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { employedAtCenter: true }
        });
        if (existingUser) {
            if (existingUser.employedAtCenterId === centerId) {
                throw new AppError(status.BAD_REQUEST, "User is already a mechanic at this center.");
            }
            if (existingUser.employedAtCenterId && existingUser.employedAtCenterId !== centerId) {
                const currentCenterName = existingUser.employedAtCenter?.name || "another workshop center";
                throw new AppError(
                    status.CONFLICT,
                    `This mechanic is already assigned to "${currentCenterName}". A mechanic cannot be assigned to multiple centers simultaneously.`
                );
            }
            const updated = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    fullName: mechanicName,
                    role: Role.MECHANIC,
                    employedAtCenterId: centerId,
                    needPasswordChange: true,
                    status: UserStatus.ACTIVE,
                    isAvailable: true
                },
                include: {
                    employedAtCenter: true
                }
            });

            // Send invitation email
            try {
                await sendEmail({
                    to: email,
                    subject: `Welcome to ${center.name} - Your Mechanic Account`,
                    templateName: "mechanicInvite",
                    templateData: {
                        name: mechanicName,
                        centerName: center.name,
                        email: email,
                        password: mechanicPassword,
                        resetUrl
                    }
                });
            } catch (err) {
                console.error("Failed to send mechanic invite email to existing user:", err);
            }

            return updated;
        }

        // Register via Better-Auth to create proper account with hashed password
        const data = await auth.api.signUpEmail({
            body: {
                name: mechanicName,
                email,
                password: mechanicPassword,
                role: Role.MECHANIC,
                status: UserStatus.ACTIVE,
                needPasswordChange: true,
                isDeleted: false
            }
        });

        if (!data.user) {
            throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create mechanic account.");
        }

        const createdMechanic = await prisma.user.update({
            where: { id: data.user.id },
            data: {
                fullName: mechanicName,
                role: Role.MECHANIC,
                emailVerified: true,
                needPasswordChange: true,
                employedAtCenterId: centerId,
                status: UserStatus.ACTIVE,
                isAvailable: true
            },
            include: {
                employedAtCenter: true
            }
        });

        // Send invitation email to mechanic
        try {
            await sendEmail({
                to: email,
                subject: `Welcome to ${center.name} - Your Mechanic Account Details`,
                templateName: "mechanicInvite",
                templateData: {
                    name: mechanicName,
                    centerName: center.name,
                    email: email,
                    password: mechanicPassword,
                    resetUrl
                }
            });
            console.log(`Mechanic welcome email sent to ${email}`);
        } catch (emailErr: any) {
            console.error("Failed to send mechanic welcome email:", emailErr?.message || emailErr);
        }

        return createdMechanic;
    }

    throw new AppError(status.BAD_REQUEST, "Please provide mechanic details (name, email, password) or mechanic ID.");
};

const verifyCenter = async (id: string, isApproved: boolean) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");

    return await prisma.automotiveCenter.update({
        where: { id },
        data: { isApproved }
    });
};

const removeMechanicFromCenter = async (centerId: string, adminId: string, mechanicId: string) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");

    const user = await prisma.user.findUnique({ where: { id: adminId } });
    if (user?.role !== Role.ADMIN && center.adminId !== adminId) {
        throw new AppError(status.FORBIDDEN, "You are not authorized to update this center.");
    }

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
    if (!mechanic) throw new AppError(status.NOT_FOUND, "Mechanic not found.");

    if (mechanic.employedAtCenterId !== centerId) {
        throw new AppError(status.BAD_REQUEST, "This mechanic is not assigned to this center.");
    }

    const updatedMechanic = await prisma.user.update({
        where: { id: mechanicId },
        data: {
            employedAtCenterId: null
        }
    });

    return updatedMechanic;
};

const deleteCenter = async (id: string) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");

    return await prisma.automotiveCenter.delete({
        where: { id }
    });
};

export const AutomotiveCenterService = {
    createCenter,
    getAllCenters,
    getCenterById,
    updateCenter,
    addMechanicToCenter,
    removeMechanicFromCenter,
    verifyCenter,
    deleteCenter
};
