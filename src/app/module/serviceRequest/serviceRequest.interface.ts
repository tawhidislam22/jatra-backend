import { ServiceType, RequestStatus } from "../../../generated/prisma/browser";

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
