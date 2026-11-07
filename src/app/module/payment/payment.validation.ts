import z from "zod";

export const PaymentValidation = {
    createCheckoutSession: z.object({
        body: z.object({
            amount: z.number().min(1, "Amount must be at least 1"),
            serviceRequestId: z.string().optional(),
            rentalBookingId: z.string().optional(),
            emergencyId: z.string().optional(),
        })
    })
};
