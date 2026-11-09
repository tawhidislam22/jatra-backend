import { Role, UserStatus } from "../../constants/prismaEnums.js";

export interface IUserFilterQuery {
    role?: Role;
    status?: UserStatus;
    searchTerm?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface IUpdateUserRoleRequest {
    role: Role;
}

export interface IUpdateUserStatusRequest {
    status: UserStatus;
}
