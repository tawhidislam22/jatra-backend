import { Role, UserStatus } from "../../constants/prismaEnums";

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
