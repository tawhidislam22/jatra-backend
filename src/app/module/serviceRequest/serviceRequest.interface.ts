import { ServiceType, RequestStatus } from "../../constants/prismaEnums.js";

export interface ICreateServiceRequest {
    serviceType?: ServiceType;
    serviceName?: string;
    scheduledDate: Date | string;
    issueDescription?: string;
    problemImages: string[];
    vehicleId: string;
    centerId: string;
    estimatedDuration?: number;
    totalAmount?: number;
}

export interface IUpdateServiceRequestStatus {
    status: RequestStatus;
}

export interface ISubmitCompletion {
    completionImages: string[];
    notes?: string;
}

export interface IVerifyCompletion {
    action: "APPROVE" | "REWORK";
    notes?: string;
    newMechanicId?: string;
}

export interface IReopenForRework {
    reason: string;
    mechanicId?: string;
}

export interface ICenterSlotAvailability {
    time: string; // "09:00", "10:00", etc.
    available: boolean;
    availableMechanicsCount: number;
    totalMechanicsCount: number;
    reason?: string;
}
