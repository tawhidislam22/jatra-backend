import { Role } from "../constants/prismaEnums.js";

export interface IRequestUser{
    userId : string;
    role : Role;
    email : string;
}