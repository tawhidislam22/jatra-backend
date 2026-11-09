import { Role } from "../constants/prismaEnums";

export interface IRequestUser{
    userId : string;
    role : Role;
    email : string;
}