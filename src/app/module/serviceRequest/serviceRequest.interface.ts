import { ServiceType, RequestStatus } from "../../constants/prismaEnums.js";

export interface ICreateServiceRequest {
    serviceType: ServiceType;
    scheduledDate: Date;
    issueDescription: string;
    vehicleId: string;
    centerId: string;
}

export interface IUpdateServiceRequestStatus {
    status: RequestStatus;
}
