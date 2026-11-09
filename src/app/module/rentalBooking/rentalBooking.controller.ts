import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { RentalBookingService } from "./rentalBooking.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";

const createBooking = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await RentalBookingService.createBooking(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Rental booking created successfully",
        data: result
    });
});

const getBookings = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await RentalBookingService.getBookings(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Rental bookings retrieved successfully",
        data: result
    });
});

const getVehicleAvailability = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { vehicleId } = req.params;
    const result = await RentalBookingService.getVehicleAvailability(vehicleId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Vehicle availability fetched successfully",
        data: result
    });
});

const updateBookingStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await RentalBookingService.updateBookingStatus(id, req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Booking status updated successfully",
        data: result
    });
});

const cancelBooking = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await RentalBookingService.cancelBooking(id, req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Rental booking cancelled and refund processed successfully",
        data: result
    });
});

export const RentalBookingController = {
    createBooking,
    getBookings,
    getVehicleAvailability,
    updateBookingStatus,
    cancelBooking
};
