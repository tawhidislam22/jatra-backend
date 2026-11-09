import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { VehicleService } from "./vehicle.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";

const registerVehicle = catchAsync(async (req: AppRequest, res: AppResponse) => {
    let payload = { ...req.body };
    if (payload.data && typeof payload.data === 'string') {
        try {
            payload = { ...JSON.parse(payload.data), ...payload };
            delete payload.data;
        } catch {
            // keep as is
        }
    }
    if (req.file) {
        payload.images = [req.file.path];
    } else if (typeof payload.images === 'string') {
        try {
            payload.images = JSON.parse(payload.images);
        } catch {
            payload.images = [payload.images];
        }
    }
    if (typeof payload.year === 'string') {
        payload.year = parseInt(payload.year, 10);
    }
    if (typeof payload.pricePerDay === 'string') {
        payload.pricePerDay = parseFloat(payload.pricePerDay);
    }
    if (typeof payload.features === 'string') {
        try {
            payload.features = JSON.parse(payload.features);
        } catch {
            payload.features = payload.features.split(',').map((f: string) => f.trim()).filter(Boolean);
        }
    }
    const result = await VehicleService.registerVehicle(req.user, payload);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Vehicle registered successfully",
        data: result
    });
});

const getAllVehicles = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await VehicleService.getAllVehicles(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Vehicles retrieved successfully",
        data: result.data,
        meta: result.meta
    });
});

const getMyVehicles = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await VehicleService.getMyVehicles(req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Your vehicles retrieved successfully",
        data: result
    });
});

const updateVehicle = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    let payload = { ...req.body };
    if (payload.data && typeof payload.data === 'string') {
        try {
            payload = { ...JSON.parse(payload.data), ...payload };
            delete payload.data;
        } catch {
            // keep as is
        }
    }
    if (req.file) {
        payload.images = [req.file.path];
    } else if (typeof payload.images === 'string') {
        try {
            payload.images = JSON.parse(payload.images);
        } catch {
            payload.images = [payload.images];
        }
    }
    if (typeof payload.year === 'string') {
        payload.year = parseInt(payload.year, 10);
    }
    if (typeof payload.pricePerDay === 'string') {
        payload.pricePerDay = parseFloat(payload.pricePerDay);
    }
    if (typeof payload.features === 'string') {
        try {
            payload.features = JSON.parse(payload.features);
        } catch {
            payload.features = payload.features.split(',').map((f: string) => f.trim()).filter(Boolean);
        }
    }

    const result = await VehicleService.updateVehicle(id, req.user, payload);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Vehicle updated successfully",
        data: result
    });
});

const getVehicleById = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const result = await VehicleService.getVehicleById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Vehicle retrieved successfully",
        data: result
    });
});

export const VehicleController = {
    registerVehicle,
    getAllVehicles,
    getMyVehicles,
    updateVehicle,
    getVehicleById
};
