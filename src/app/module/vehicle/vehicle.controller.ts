import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { VehicleService } from "./vehicle.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";

const registerVehicle = catchAsync(async (req: Request | any, res: Response) => {
    const result = await VehicleService.registerVehicle(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Vehicle registered successfully",
        data: result
    });
});

const getAllVehicles = catchAsync(async (req: Request, res: Response) => {
    const result = await VehicleService.getAllVehicles(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Vehicles retrieved successfully",
        data: result
    });
});

const getMyVehicles = catchAsync(async (req: Request | any, res: Response) => {
    const result = await VehicleService.getMyVehicles(req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Your vehicles retrieved successfully",
        data: result
    });
});

const updateVehicle = catchAsync(async (req: Request | any, res: Response) => {
    const { id } = req.params;
    const result = await VehicleService.updateVehicle(id, req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Vehicle updated successfully",
        data: result
    });
});

export const VehicleController = {
    registerVehicle,
    getAllVehicles,
    getMyVehicles,
    updateVehicle
};
