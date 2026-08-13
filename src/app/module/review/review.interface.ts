export interface ICreateReviewRequest {
    rating: number;
    comment?: string;
    centerId: string;
    serviceRequestId?: string;
    rentalBookingId?: string;
}
