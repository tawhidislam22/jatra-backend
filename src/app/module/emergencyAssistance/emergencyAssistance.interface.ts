import { RequestStatus } from "../../../generated/prisma/browser";

export interface IRequestAssistanceRequest {
    latitude: number;
    longitude: number;
    issueDescription: string;
    centerId: string;
}

export interface IUpdateEmergencyStatusRequest {
    status: RequestStatus;
}
