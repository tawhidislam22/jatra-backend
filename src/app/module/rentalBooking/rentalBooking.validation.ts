import z from "zod";
import { RequestStatus } from "../../constants/prismaEnums.js";

export const RentalBookingValidation = {
    createBooking: z.object({
        body: z.object({
            vehicleId: z.string().min(1, "Vehicle ID is required"),
            pickupDate: z.string().min(1, "Pickup date is required").transform(str => new Date(str)),
            returnDate: z.string().min(1, "Return date is required").transform(str => new Date(str)),
            totalAmount: z.number(),
        })
    }),
    updateBookingStatus: z.object({
        body: z.object({
            status: z.nativeEnum(RequestStatus)
        })
    })
};
