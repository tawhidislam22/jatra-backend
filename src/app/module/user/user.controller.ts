import { AppRequest, AppResponse } from "../../interfaces/http.interface";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";

const getAllUsers = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await UserService.getAllUsers(req.query as any);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Users retrieved successfully",
        meta: result.meta,
        data: result.data
    });
});

const getUserById = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const result = await UserService.getUserById(id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User details retrieved successfully",
        data: result
    });
});

const updateUserRole = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const { role } = req.body;
    const result = await UserService.updateUserRole(id, role);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User role updated successfully",
        data: result
    });
});

const updateUserStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const { status: userStatus } = req.body;
    const result = await UserService.updateUserStatus(id, userStatus);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User status updated successfully",
        data: result
    });
});

const deleteUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const id = req.params.id as string;
    const result = await UserService.deleteUser(id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User deleted successfully",
        data: result
    });
});

const getAdminOverviewStats = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const result = await UserService.getAdminOverviewStats();
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Admin overview statistics retrieved successfully",
        data: result
    });
});

export const UserController = {
    getAllUsers,
    getUserById,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    getAdminOverviewStats
};
