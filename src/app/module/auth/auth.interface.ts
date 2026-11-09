import { Role } from "../../constants/prismaEnums";

export interface ILoginUserPayload {
    email: string;
    password: string;
}

export interface IRegisterUserPayload {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role?: Role;
}

export interface IChangePasswordPayload {
    currentPassword: string;
    newPassword: string;
}