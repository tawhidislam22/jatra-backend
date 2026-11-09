import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { ICreateReviewRequest } from "./review.interface.js";
import { NotificationService } from "../notification/notification.service.js";
import { RequestStatus } from "../../constants/prismaEnums.js";

const recalculateCenterRating = async (centerId: string) => {
    const reviews = await prisma.review.findMany({
        where: { centerId },
        select: { rating: true }
    });

    if (reviews.length === 0) return;

    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avg = Number((total / reviews.length).toFixed(1));

    await prisma.automotiveCenter.update({
        where: { id: centerId },
        data: { rating: avg }
    });
};

const createReview = async (userId: string, payload: ICreateReviewRequest) => {
    const center = await prisma.automotiveCenter.findUnique({ where: { id: payload.centerId } });
    if (!center) throw new AppError(status.NOT_FOUND, "Automotive center not found.");

    // If reviewing a service request, verify that customer owns it and work is DONE
    if (payload.serviceRequestId) {
        const serviceReq = await prisma.serviceRequest.findUnique({
            where: { id: payload.serviceRequestId }
        });
        if (!serviceReq) throw new AppError(status.NOT_FOUND, "Service request not found.");
        if (serviceReq.customerId !== userId) {
            throw new AppError(status.FORBIDDEN, "You are not authorized to review this service request.");
        }
        if (serviceReq.status !== RequestStatus.DONE) {
            throw new AppError(status.BAD_REQUEST, "Review can only be submitted after the workshop manager has approved the completed service.");
        }

        const existingReview = await prisma.review.findUnique({
            where: { serviceRequestId: payload.serviceRequestId }
        });
        if (existingReview) {
            throw new AppError(status.CONFLICT, "A review has already been submitted for this service.");
        }
    }

    if (payload.rentalBookingId) {
        const existingReview = await prisma.review.findUnique({
            where: { rentalBookingId: payload.rentalBookingId }
        });
        if (existingReview) {
            throw new AppError(status.CONFLICT, "A review has already been submitted for this booking.");
        }
    }

    const review = await prisma.review.create({
        data: {
            customerId: userId,
            centerId: payload.centerId,
            serviceRequestId: payload.serviceRequestId,
            rentalBookingId: payload.rentalBookingId,
            rating: payload.rating,
            comment: payload.comment
        },
        include: { customer: true }
    });

    // Recalculate center aggregate rating
    await recalculateCenterRating(payload.centerId);

    // Notify center owner
    const isLowRating = payload.rating <= 2;
    await NotificationService.createNotification({
        userId: center.adminId,
        title: isLowRating ? `⚠️ Low Rating Alert (${payload.rating}★)` : `New Customer Review (${payload.rating}★)`,
        message: isLowRating
            ? `Customer rated ${payload.rating}★ for Job #${payload.serviceRequestId?.slice(0, 8) || 'Booking'}: "${payload.comment || 'No comment'}". You can investigate and reopen this job for rework.`
            : `${review.customer?.fullName || review.customer?.name || "A customer"} left a ${payload.rating}★ review: "${payload.comment || 'Great service!'}"`,
        type: "REVIEW",
        link: `/owner/dashboard/reviews`
    });

    return review;
};

const getCenterReviews = async (centerId: string) => {
    return await prisma.review.findMany({
        where: { centerId },
        include: { customer: true },
        orderBy: { createdAt: 'desc' }
    });
};

const getMyReviews = async (userId: string) => {
    return await prisma.review.findMany({
        where: { customerId: userId },
        include: {
            center: true,
            rentalBooking: { include: { vehicle: true } },
            serviceRequest: { include: { vehicle: true } }
        },
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

    const deleted = await prisma.review.delete({
        where: { id }
    });

    await recalculateCenterRating(review.centerId);
    return deleted;
};

export const ReviewService = {
    createReview,
    getCenterReviews,
    getMyReviews,
    getAllReviews,
    deleteReview
};
