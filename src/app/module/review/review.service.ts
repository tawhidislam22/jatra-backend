import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { ICreateReviewRequest } from "./review.interface.js";

const createReview = async (userId: string, payload: ICreateReviewRequest) => {
    // Basic validation to ensure they are reviewing a valid center
    const center = await prisma.automotiveCenter.findUnique({ where: { id: payload.centerId } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive center not found.");

    return await prisma.review.create({
        data: {
            customerId: userId,
            centerId: payload.centerId,
            serviceRequestId: payload.serviceRequestId,
            rentalBookingId: payload.rentalBookingId,
            rating: payload.rating,
            comment: payload.comment
        }
    });
};

const getCenterReviews = async (centerId: string) => {
    return await prisma.review.findMany({
        where: { centerId },
        include: { customer: true }
    });
};

const getMyReviews = async (userId: string) => {
    return await prisma.review.findMany({
        where: { customerId: userId },
        include: { center: true, rentalBooking: { include: { vehicle: true } } },
        orderBy: { createdAt: 'desc' }
    });
};

const getAllReviews = async () => {
    return await prisma.review.findMany({
        include: { customer: true, center: true },
        orderBy: { createdAt: 'desc' }
    });
};

const deleteReview = async (id: string) => {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new AppError(status.NOT_FOUND, "Review not found.");

    return await prisma.review.delete({
        where: { id }
    });
};

export const ReviewService = {
    createReview,
    getCenterReviews,
    getMyReviews,
    getAllReviews,
    deleteReview
};
