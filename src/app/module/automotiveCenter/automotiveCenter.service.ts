import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, UserStatus } from "../../constants/prismaEnums.js";
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
                admin: true,
                mechanics: {
                    where: {
                        status: UserStatus.ACTIVE,
                        isDeleted: false,
                        isAvailable: true
                    }
                }
            }
        }),
        prisma.automotiveCenter.count({ where: whereConditions })
    ]);

    if (isPublic) {
        const { ServiceRequestService } = await import("../serviceRequest/serviceRequest.service.js");
        const todayStr = (query.date as string) || new Date().toISOString().split("T")[0];

        // Recalculate real-time free slots and filter out centers where all mechanics are busy during this time
        const populatedCenters = await Promise.all(
            centers.map(async (center) => {
                try {
                    const avail = await ServiceRequestService.getCenterAvailability(center.id, todayStr);
                    const openSlots = avail.slots.filter(s => s.available);
                    if (openSlots.length === 0) {
                        return null; // All mechanics are busy or no free slots available
                    }
                    return {
                        ...center,
                        totalMechanicsCount: avail.totalMechanicsCount,
                        freeSlotsCount: openSlots.length,
                        nextFreeSlot: openSlots[0]?.time || null,
                        availableSlots: openSlots.map(s => s.time)
                    };
                } catch {
                    return null;
                }
            })
        );

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
    const center = await prisma.automotiveCenter.findUnique({
        where: { id },
        include: {
            mechanics: {
                where: {
                    status: UserStatus.ACTIVE,
                    isDeleted: false
                }
            },
            rentalFleet: true,
            reviews: true,
            admin: true
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
        const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
        if (!mechanic) {
            throw new AppError(status.NOT_FOUND, "Mechanic user not found.");
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

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (existingUser.employedAtCenterId === centerId) {
                throw new AppError(status.BAD_REQUEST, "User is already a mechanic at this center.");
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
    verifyCenter,
    deleteCenter
};
