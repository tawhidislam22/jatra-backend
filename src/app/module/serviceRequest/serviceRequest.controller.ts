import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { ServiceRequestService } from "./serviceRequest.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";

const createRequest = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await ServiceRequestService.createRequest(req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Service request created successfully",
        data: result
    });
});

const getRequests = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await ServiceRequestService.getRequests(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Service requests retrieved successfully",
        data: result
    });
});

const assignMechanic = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const { mechanicId } = req.body;
    const result = await ServiceRequestService.assignMechanic(id, req.user.userId, mechanicId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mechanic assigned successfully",
        data: result
    });
});

const updateStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await ServiceRequestService.updateStatus(id, req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Service status updated successfully",
        data: result
    });
});

export const ServiceRequestController = {
    createRequest,
    getRequests,
    assignMechanic,
    updateStatus
};
