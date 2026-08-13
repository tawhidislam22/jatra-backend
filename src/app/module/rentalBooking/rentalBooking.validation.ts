import z from "zod";
import { RequestStatus } from "../../../generated/prisma/browser";

export const RentalBookingValidation = {
    createBooking: z.object({
        body: z.object({
            vehicleId: z.string({ required_error: "Vehicle ID is required" }),
            pickupDate: z.string({ required_error: "Pickup date is required" }).transform(str => new Date(str)),
            returnDate: z.string({ required_error: "Return date is required" }).transform(str => new Date(str)),
            totalAmount: z.number({ required_error: "Total amount is required" }),
        })
    }),
    updateBookingStatus: z.object({
        body: z.object({
            status: z.nativeEnum(RequestStatus)
        })
    })
};
