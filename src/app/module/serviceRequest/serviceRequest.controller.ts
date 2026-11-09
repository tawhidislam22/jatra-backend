import { AppRequest, AppResponse } from "../../interfaces/http.interface.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { ServiceRequestService } from "./serviceRequest.service.js";
import { sendResponse } from "../../shared/sendResponse.js";
import status from "http-status";

const getCenterAvailability = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { centerId } = req.params;
    const { date, duration } = req.query;
    const dateStr = (date as string) || new Date().toISOString().split("T")[0];
    const durationMins = duration ? Number(duration) : 60;

    const result = await ServiceRequestService.getCenterAvailability(centerId, dateStr, durationMins);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Center slot availability retrieved successfully",
        data: result
    });
});

const createRequest = catchAsync(async (req: AppRequest, res: AppResponse) => {
    // Extract uploaded problem photos from Multer files or JSON body
    let problemImages: string[] = [];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        problemImages = req.files.map((f: any) => f.path || f.url || f.location);
    } else if (req.file) {
        problemImages = [(req.file as any).path || (req.file as any).url];
    } else if (Array.isArray(req.body.problemImages)) {
        problemImages = req.body.problemImages;
    }

    const result = await ServiceRequestService.createRequest(req.user.userId, req.body, problemImages);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Service booking created successfully (awaiting payment)",
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
    const { mechanicId, notes } = req.body;
    const result = await ServiceRequestService.assignMechanic(id, req.user.userId, mechanicId, notes);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mechanic assigned successfully",
        data: result
    });
});

const startWork = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await ServiceRequestService.startWork(id, req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Repair work started successfully",
        data: result
    });
});

const submitCompletion = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;

    let completionImages: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        completionImages = req.files.map((f: any) => f.path || f.url || f.location);
    } else if (req.file) {
        completionImages = [(req.file as any).path || (req.file as any).url];
    } else if (Array.isArray(req.body.completionImages)) {
        completionImages = req.body.completionImages;
    }

    const result = await ServiceRequestService.submitCompletion(id, req.user.userId, {
        completionImages,
        notes: req.body.notes
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Work completed and submitted for manager review",
        data: result
    });
});

const verifyCompletion = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await ServiceRequestService.verifyCompletion(id, req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: req.body.action === "APPROVE" ? "Service approved and marked as DONE" : "Rework requested successfully",
        data: result
    });
});

const reopenForRework = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;
    const result = await ServiceRequestService.reopenForRework(id, req.user.userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Service request reopened for rework",
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
    getCenterAvailability,
    createRequest,
    getRequests,
    assignMechanic,
    startWork,
    submitCompletion,
    verifyCompletion,
    reopenForRework,
    updateStatus
};
