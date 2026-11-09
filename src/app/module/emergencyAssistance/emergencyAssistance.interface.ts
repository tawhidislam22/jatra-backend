import { RequestStatus } from "../../constants/prismaEnums.js";

export interface IRequestAssistanceRequest {
    latitude: number;
    longitude: number;
    issueDescription: string;
    centerId: string;
}

export interface IUpdateEmergencyStatusRequest {
    status: RequestStatus;
}
