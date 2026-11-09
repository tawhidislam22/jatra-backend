import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { AutomotiveCenterService } from "./automotiveCenter.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { tokenUtils } from "../../utils/token.js";
import status from "http-status";

const createCenter = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const userId = req.user.userId;
    const payload = { ...req.body };
    if (req.file) {
        payload.images = [req.file.path];
    } else if (typeof payload.images === 'string') {
        try {
            payload.images = JSON.parse(payload.images);
        } catch {
            payload.images = [payload.images];
        }
    }
    if (typeof payload.servicesOffered === 'string') {
        try {
            payload.servicesOffered = JSON.parse(payload.servicesOffered);
        } catch {
            payload.servicesOffered = [payload.servicesOffered];
        }
    }
    if (typeof payload.customServices === 'string') {
        try {
            payload.customServices = JSON.parse(payload.customServices);
        } catch {
            // Keep as string if parsing fails
        }
    }
    const result = await AutomotiveCenterService.createCenter(userId, payload);

    // Issue updated accessToken with OWNER role
    const newAccessToken = tokenUtils.getAccessToken({
        userId: req.user.userId,
        role: "OWNER",
        name: req.user.name,
        fullName: req.user.fullName || req.user.name,
        email: req.user.email,
        status: req.user.status,
        isDeleted: req.user.isDeleted,
        emailVerified: req.user.emailVerified,
    });
    tokenUtils.setAccessTokenCookie(res, newAccessToken);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Automotive Center registered successfully",
        data: {
            ...result,
            accessToken: newAccessToken,
        }
    });
});

const getAllCenters = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await AutomotiveCenterService.getAllCenters(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Centers retrieved successfully",
        data: result.data,
        meta: result.meta
    });
});

const getCenterById = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const result = await AutomotiveCenterService.getCenterById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Center details retrieved successfully",
        data: result
    });
});

const updateCenter = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const adminId = req.user.userId;
    const payload = { ...req.body };
    if (req.file) {
        payload.images = [req.file.path];
    } else if (typeof payload.images === 'string') {
        try {
            payload.images = JSON.parse(payload.images);
        } catch {
            payload.images = [payload.images];
        }
    }
    if (typeof payload.servicesOffered === 'string') {
        try {
            payload.servicesOffered = JSON.parse(payload.servicesOffered);
        } catch {
            payload.servicesOffered = [payload.servicesOffered];
        }
    }
    if (typeof payload.customServices === 'string') {
        try {
            payload.customServices = JSON.parse(payload.customServices);
        } catch {
            // Keep as string if parsing fails
        }
    }
    const result = await AutomotiveCenterService.updateCenter(id, adminId, payload);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Center updated successfully",
        data: result
    });
});

const addMechanicToCenter = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const adminId = req.user.userId;
    
    const result = await AutomotiveCenterService.addMechanicToCenter(id, adminId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mechanic added to center successfully",
        data: result
    });
});

const verifyCenter = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const { isApproved } = req.body;
    const result = await AutomotiveCenterService.verifyCenter(id, isApproved ?? true);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: isApproved ? "Automotive Center approved successfully" : "Automotive Center approval revoked",
        data: result
    });
});

const deleteCenter = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await AutomotiveCenterService.deleteCenter(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Automotive Center deleted successfully",
        data: result
    });
});

export const AutomotiveCenterController = {
    createCenter,
    getAllCenters,
    getCenterById,
    updateCenter,
    addMechanicToCenter,
    verifyCenter,
    deleteCenter
};
