import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { RentalBookingService } from "./rentalBooking.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";

const createBooking = catchAsync(async (req: Request | any, res: Response) => {
    const result = await RentalBookingService.createBooking(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Rental booking created successfully",
        data: result
    });
});

const getBookings = catchAsync(async (req: Request | any, res: Response) => {
    const result = await RentalBookingService.getBookings(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Rental bookings retrieved successfully",
        data: result
    });
});

const updateBookingStatus = catchAsync(async (req: Request | any, res: Response) => {
    const { id } = req.params;
    const result = await RentalBookingService.updateBookingStatus(id, req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Booking status updated successfully",
        data: result
    });
});

export const RentalBookingController = {
    createBooking,
    getBookings,
    updateBookingStatus
};
