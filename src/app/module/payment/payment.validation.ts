import z from "zod";

export const PaymentValidation = {
    createCheckoutSession: z.object({
        body: z.object({
            amount: z.number({ required_error: "Amount is required" }).min(1),
            serviceRequestId: z.string().optional(),
            rentalBookingId: z.string().optional(),
            emergencyId: z.string().optional(),
        })
    })
};
