import { RequestStatus } from "../../../generated/prisma/browser";

export interface ICreateBookingRequest {
    vehicleId: string;
    pickupDate: Date;
    returnDate: Date;
    totalAmount: number;
}

export interface IUpdateBookingStatusRequest {
    status: RequestStatus;
}
