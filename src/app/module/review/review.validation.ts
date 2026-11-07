import z from "zod";

export const ReviewValidation = {
    createReview: z.object({
        body: z.object({
            rating: z.number().int().min(1).max(5),
            comment: z.string().optional(),
            centerId: z.string().min(1, "Center ID is required"),
            serviceRequestId: z.string().optional(),
            rentalBookingId: z.string().optional(),
        })
    })
};
