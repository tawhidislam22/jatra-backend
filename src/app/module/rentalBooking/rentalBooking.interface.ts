import { RequestStatus } from "../../constants/prismaEnums.js";

export interface ICreateBookingRequest {
    vehicleId: string;
    pickupDate: Date;
    returnDate: Date;
    totalAmount: number;
}

export interface IUpdateBookingStatusRequest {
    status: RequestStatus;
}
