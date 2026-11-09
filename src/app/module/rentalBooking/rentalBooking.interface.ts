import { RequestStatus } from "../../constants/prismaEnums.js";

export interface ICreateBookingRequest {
    vehicleId: string;
    pickupDate: Date | string;
    returnDate: Date | string;
    totalAmount?: number;
}

export interface IUpdateBookingStatusRequest {
    status: RequestStatus;
}

export interface ICancelBookingRequest {
    reason?: string;
}
