import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { Role, UserStatus } from "../../constants/prismaEnums";
import { auth } from "../../lib/auth";
import { ICreateCenterRequest, IUpdateCenterRequest } from "./automotiveCenter.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { sendEmail } from "../../utils/email";
import { envVars } from "../../config/env";

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
    const centerQuery = new QueryBuilder(prisma.automotiveCenter as any, query, {
        searchableFields: ['name', 'address'],
        filterableFields: ['isApproved', 'rating', 'adminId']
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .fields()
        .include({ admin: true, mechanics: true });

    return await centerQuery.execute();
};

const getCenterById = async (id: string) => {
    const center = await prisma.automotiveCenter.findUnique({
        where: { id },
        include: { mechanics: true, rentalFleet: true, reviews: true, admin: true }
    });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive Center not found.");
    return center;
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
                employedAtCenterId: centerId
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
                    status: UserStatus.ACTIVE
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
                status: UserStatus.ACTIVE
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
