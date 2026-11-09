import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { Role, UserStatus, RequestStatus, VehicleType } from "../../constants/prismaEnums.js";
import { IUserFilterQuery } from "./user.interface.js";

const getAllUsers = async (query: IUserFilterQuery) => {
    const { role, status: userStatus, searchTerm, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const whereClause: any = {
        isDeleted: false
    };

    if (role) {
        whereClause.role = role;
    }

    if (userStatus) {
        whereClause.status = userStatus;
    }

    if (searchTerm) {
        whereClause.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { fullName: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } }
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: {
                [sortBy]: sortOrder
            },
            include: {
                managedCenters: {
                    select: { id: true, name: true, isApproved: true, rating: true }
                },
                employedAtCenter: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: {
                        ownedVehicles: true,
                        rentalBookings: true,
                        serviceRequests: true,
                        assignedServices: true,
                        reviews: true
                    }
                }
            }
        }),
        prisma.user.count({ where: whereClause })
    ]);

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
        },
        data: users
    };
};

const getUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            managedCenters: true,
            employedAtCenter: true,
            ownedVehicles: true,
            rentalBookings: {
                include: { vehicle: true, payment: true },
                take: 10,
                orderBy: { pickupDate: 'desc' }
            },
            serviceRequests: {
                include: { vehicle: true, center: true, mechanic: true },
                take: 10,
                orderBy: { scheduledDate: 'desc' }
            },
            assignedServices: {
                include: { vehicle: true, center: true, customer: true },
                take: 10,
                orderBy: { scheduledDate: 'desc' }
            },
            reviews: {
                include: { center: true },
                take: 10,
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return user;
};

const updateUserRole = async (id: string, role: Role) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return await prisma.user.update({
        where: { id },
        data: { role }
    });
};

const updateUserStatus = async (id: string, userStatus: UserStatus) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return await prisma.user.update({
        where: { id },
        data: { status: userStatus }
    });
};

const deleteUser = async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return await prisma.user.update({
        where: { id },
        data: {
            isDeleted: true,
            status: UserStatus.DELETED,
            deletedAt: new Date()
        }
    });
};

const getAdminOverviewStats = async () => {
    const [
        totalUsers,
        totalCustomers,
        totalOwners,
        totalMechanics,
        totalAdmins,
        activeUsers,
        blockedUsers,
        totalCenters,
        approvedCenters,
        pendingCenters,
        totalVehicles,
        rentalVehicles,
        customerVehicles,
        totalServiceRequests,
        pendingServices,
        inProgressServices,
        completedServices,
        totalBookings,
        bookingAggregate,
        totalPayments,
        paymentAggregate,
        recentUsers,
        recentPendingCenters,
        recentBookings
    ] = await Promise.all([
        prisma.user.count({ where: { isDeleted: false } }),
        prisma.user.count({ where: { role: Role.CUSTOMER, isDeleted: false } }),
        prisma.user.count({ where: { role: Role.OWNER, isDeleted: false } }),
        prisma.user.count({ where: { role: Role.MECHANIC, isDeleted: false } }),
        prisma.user.count({ where: { role: Role.ADMIN, isDeleted: false } }),
        prisma.user.count({ where: { status: UserStatus.ACTIVE, isDeleted: false } }),
        prisma.user.count({ where: { status: UserStatus.BLOCKED, isDeleted: false } }),
        prisma.automotiveCenter.count(),
        prisma.automotiveCenter.count({ where: { isApproved: true } }),
        prisma.automotiveCenter.count({ where: { isApproved: false } }),
        prisma.vehicle.count(),
        prisma.vehicle.count({ where: { type: VehicleType.RENTAL_FLEET } }),
        prisma.vehicle.count({ where: { type: VehicleType.CUSTOMER_OWNED } }),
        prisma.serviceRequest.count(),
        prisma.serviceRequest.count({ where: { status: RequestStatus.PENDING } }),
        prisma.serviceRequest.count({ where: { status: RequestStatus.IN_PROGRESS } }),
        prisma.serviceRequest.count({ where: { status: RequestStatus.COMPLETED } }),
        prisma.rentalBooking.count(),
        prisma.rentalBooking.aggregate({
            _sum: { totalAmount: true }
        }),
        prisma.payment.count(),
        prisma.payment.aggregate({
            _sum: { amount: true }
        }),
        prisma.user.findMany({
            where: { isDeleted: false },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, fullName: true, email: true, role: true, status: true, createdAt: true }
        }),
        prisma.automotiveCenter.findMany({
            where: { isApproved: false },
            take: 5,
            orderBy: { rating: 'desc' },
            include: { admin: { select: { fullName: true, name: true, email: true, phone: true } } }
        }),
        prisma.rentalBooking.findMany({
            take: 5,
            orderBy: { pickupDate: 'desc' },
            include: { customer: { select: { fullName: true, name: true, email: true } }, vehicle: { select: { make: true, model: true } } }
        })
    ]);

    const totalRevenue = (paymentAggregate._sum.amount || 0) + (bookingAggregate._sum.totalAmount || 0);

    return {
        users: {
            total: totalUsers,
            customers: totalCustomers,
            owners: totalOwners,
            mechanics: totalMechanics,
            admins: totalAdmins,
            active: activeUsers,
            blocked: blockedUsers
        },
        centers: {
            total: totalCenters,
            approved: approvedCenters,
            pending: pendingCenters
        },
        vehicles: {
            total: totalVehicles,
            rental: rentalVehicles,
            customerOwned: customerVehicles
        },
        serviceRequests: {
            total: totalServiceRequests,
            pending: pendingServices,
            inProgress: inProgressServices,
            completed: completedServices
        },
        financials: {
            totalBookings,
            totalBookingsGross: bookingAggregate._sum.totalAmount || 0,
            totalPayments,
            totalPaymentsVolume: paymentAggregate._sum.amount || 0,
            grossPlatformVolume: totalRevenue,
            estimatedPlatformRevenue: totalRevenue * 0.10 // 10% platform take rate
        },
        recentActivity: {
            users: recentUsers,
            pendingCenters: recentPendingCenters,
            bookings: recentBookings
        }
    };
};

export const UserService = {
    getAllUsers,
    getUserById,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    getAdminOverviewStats
};
