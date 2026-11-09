import { RequestStatus } from "../../constants/prismaEnums";

export interface IRequestAssistanceRequest {
    latitude: number;
    longitude: number;
    issueDescription: string;
    centerId: string;
}

export interface IUpdateEmergencyStatusRequest {
    status: RequestStatus;
}
