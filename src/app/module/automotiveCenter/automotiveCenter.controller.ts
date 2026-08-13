import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { AutomotiveCenterService } from "./automotiveCenter.service";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";

const createCenter = catchAsync(async (req: Request | any, res: Response) => {
    const userId = req.user.userId;
    const result = await AutomotiveCenterService.createCenter(userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Automotive Center registered successfully",
        data: result
    });
});

const getAllCenters = catchAsync(async (req: Request, res: Response) => {
    const result = await AutomotiveCenterService.getAllCenters();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Centers retrieved successfully",
        data: result
    });
});

const getCenterById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await AutomotiveCenterService.getCenterById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Center details retrieved successfully",
        data: result
    });
});

const updateCenter = catchAsync(async (req: Request | any, res: Response) => {
    const { id } = req.params;
    const adminId = req.user.userId;
    const result = await AutomotiveCenterService.updateCenter(id, adminId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Center updated successfully",
        data: result
    });
});

const addMechanicToCenter = catchAsync(async (req: Request | any, res: Response) => {
    const { id } = req.params;
    const adminId = req.user.userId;
    const { mechanicId } = req.body;
    
    const result = await AutomotiveCenterService.addMechanicToCenter(id, adminId, mechanicId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mechanic added to center successfully",
        data: result
    });
});

export const AutomotiveCenterController = {
    createCenter,
    getAllCenters,
    getCenterById,
    updateCenter,
    addMechanicToCenter
};
