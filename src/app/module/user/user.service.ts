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
        userRoles,
        userStatuses,
        centerStats,
        vehicleTypes,
        serviceStatuses,
        bookingAggregate,
        paymentAggregate,
        recentUsers,
        recentPendingCenters,
        recentBookings
    ] = await Promise.all([
        prisma.user.groupBy({
            by: ['role'],
            where: { isDeleted: false },
            _count: { id: true }
        }),
        prisma.user.groupBy({
            by: ['status'],
            where: { isDeleted: false },
            _count: { id: true }
        }),
        prisma.automotiveCenter.groupBy({
            by: ['isApproved'],
            _count: { id: true }
        }),
        prisma.vehicle.groupBy({
            by: ['type'],
            _count: { id: true }
        }),
        prisma.serviceRequest.groupBy({
            by: ['status'],
            _count: { id: true }
        }),
        prisma.rentalBooking.aggregate({
            _count: { id: true },
            _sum: { totalAmount: true }
        }),
        prisma.payment.aggregate({
            _count: { id: true },
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

    // Parse aggregated groups in memory with zero overhead
    const roleCounts: Record<string, number> = {};
    let totalUsers = 0;
    for (const item of userRoles) {
        roleCounts[item.role] = item._count.id;
        totalUsers += item._count.id;
    }

    const statusCounts: Record<string, number> = {};
    for (const item of userStatuses) {
        statusCounts[item.status] = item._count.id;
    }

    let totalCenters = 0;
    let approvedCenters = 0;
    let pendingCenters = 0;
    for (const item of centerStats) {
        totalCenters += item._count.id;
        if (item.isApproved) approvedCenters += item._count.id;
        else pendingCenters += item._count.id;
    }

    let totalVehicles = 0;
    let rentalVehicles = 0;
    let customerVehicles = 0;
    for (const item of vehicleTypes) {
        totalVehicles += item._count.id;
        if (item.type === VehicleType.RENTAL_FLEET) rentalVehicles += item._count.id;
        else if (item.type === VehicleType.CUSTOMER_OWNED) customerVehicles += item._count.id;
    }

    let totalServiceRequests = 0;
    let pendingServices = 0;
    let inProgressServices = 0;
    let completedServices = 0;
    for (const item of serviceStatuses) {
        totalServiceRequests += item._count.id;
        if (item.status === RequestStatus.PENDING) pendingServices += item._count.id;
        else if (item.status === RequestStatus.IN_PROGRESS) inProgressServices += item._count.id;
        else if (item.status === RequestStatus.COMPLETED) completedServices += item._count.id;
    }

    const totalRevenue = (paymentAggregate._sum.amount || 0) + (bookingAggregate._sum.totalAmount || 0);

    return {
        users: {
            total: totalUsers,
            customers: roleCounts[Role.CUSTOMER] || 0,
            owners: roleCounts[Role.OWNER] || 0,
            mechanics: roleCounts[Role.MECHANIC] || 0,
            admins: roleCounts[Role.ADMIN] || 0,
            active: statusCounts[UserStatus.ACTIVE] || 0,
            blocked: statusCounts[UserStatus.BLOCKED] || 0
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
            totalBookings: bookingAggregate._count.id || 0,
            totalBookingsGross: bookingAggregate._sum.totalAmount || 0,
            totalPayments: paymentAggregate._count.id || 0,
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
