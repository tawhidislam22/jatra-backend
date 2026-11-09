import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { EmergencyAssistanceService } from "./emergencyAssistance.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";

const requestAssistance = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await EmergencyAssistanceService.requestAssistance(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Emergency assistance requested successfully",
        data: result
    });
});

const getEmergencies = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await EmergencyAssistanceService.getEmergencies(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Emergency requests retrieved successfully",
        data: result
    });
});

const assignMechanic = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const { mechanicId } = req.body;
    const result = await EmergencyAssistanceService.assignMechanic(id, req.user.userId, mechanicId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mechanic assigned to emergency successfully",
        data: result
    });
});

const updateStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await EmergencyAssistanceService.updateStatus(id, req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Emergency status updated successfully",
        data: result
    });
});

export const EmergencyAssistanceController = {
    requestAssistance,
    getEmergencies,
    assignMechanic,
    updateStatus
};
