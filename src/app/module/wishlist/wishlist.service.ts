import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { WishlistItemType } from "../../constants/prismaEnums.js";

const toggleWishlist = async (
    userId: string,
    payload: { vehicleId?: string; centerId?: string }
) => {
    const { vehicleId, centerId } = payload;

    if (!vehicleId && !centerId) {
        throw new AppError(status.BAD_REQUEST, "Either vehicleId or centerId must be provided.");
    }

    if (vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle) {
            throw new AppError(status.NOT_FOUND, "Vehicle not found.");
        }

        const existing = await prisma.wishlistItem.findFirst({
            where: { userId, vehicleId }
        });

        if (existing) {
            await prisma.wishlistItem.delete({ where: { id: existing.id } });
            return { wishlisted: false, type: "VEHICLE", id: vehicleId, message: "Vehicle removed from wishlist." };
        } else {
            const item = await prisma.wishlistItem.create({
                data: {
                    userId,
                    vehicleId,
                    itemType: WishlistItemType.VEHICLE
                }
            });
            return { wishlisted: true, type: "VEHICLE", id: vehicleId, itemId: item.id, message: "Vehicle added to wishlist." };
        }
    }

    if (centerId) {
        const center = await prisma.automotiveCenter.findUnique({ where: { id: centerId } });
        if (!center) {
            throw new AppError(status.NOT_FOUND, "Service center not found.");
        }

        const existing = await prisma.wishlistItem.findFirst({
            where: { userId, centerId }
        });

        if (existing) {
            await prisma.wishlistItem.delete({ where: { id: existing.id } });
            return { wishlisted: false, type: "CENTER", id: centerId, message: "Center removed from wishlist." };
        } else {
            const item = await prisma.wishlistItem.create({
                data: {
                    userId,
                    centerId,
                    itemType: WishlistItemType.CENTER
                }
            });
            return { wishlisted: true, type: "CENTER", id: centerId, itemId: item.id, message: "Center added to wishlist." };
        }
    }

    throw new AppError(status.BAD_REQUEST, "Invalid wishlist request.");
};

const getMyWishlist = async (userId: string) => {
    const items = await prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
            vehicle: {
                include: {
                    center: {
                        select: { id: true, name: true, address: true, rating: true, phone: true }
                    }
                }
            },
            center: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    rating: true,
                    phone: true,
                    images: true,
                    servicesOffered: true,
                    customServices: true,
                }
            }
        }
    });

    const vehicles = items
        .filter((item) => item.itemType === WishlistItemType.VEHICLE && item.vehicle)
        .map((item) => ({
            wishlistId: item.id,
            addedAt: item.createdAt,
            vehicle: item.vehicle,
        }));

    const centers = items
        .filter((item) => item.itemType === WishlistItemType.CENTER && item.center)
        .map((item) => ({
            wishlistId: item.id,
            addedAt: item.createdAt,
            center: item.center,
        }));

    return {
        total: items.length,
        vehicles,
        centers
    };
};

const getMyWishlistIds = async (userId: string) => {
    const items = await prisma.wishlistItem.findMany({
        where: { userId },
        select: {
            id: true,
            vehicleId: true,
            centerId: true,
            itemType: true,
        }
    });

    const vehicleIds: string[] = [];
    const centerIds: string[] = [];

    items.forEach((item) => {
        if (item.vehicleId) vehicleIds.push(item.vehicleId);
        if (item.centerId) centerIds.push(item.centerId);
    });

    return {
        vehicleIds,
        centerIds,
    };
};

const removeWishlistItem = async (userId: string, id: string) => {
    const item = await prisma.wishlistItem.findUnique({
        where: { id }
    });

    if (!item) {
        throw new AppError(status.NOT_FOUND, "Wishlist item not found.");
    }

    if (item.userId !== userId) {
        throw new AppError(status.FORBIDDEN, "Not authorized to remove this item.");
    }

    await prisma.wishlistItem.delete({ where: { id } });

    return { success: true, message: "Item removed from wishlist." };
};

export const WishlistService = {
    toggleWishlist,
    getMyWishlist,
    getMyWishlistIds,
    removeWishlistItem,
};
