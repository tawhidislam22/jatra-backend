export interface ICreateCheckoutSessionRequest {
    amount: number;
    serviceRequestId?: string;
    rentalBookingId?: string;
    emergencyId?: string;
}
