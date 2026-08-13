import z from "zod";
import { VehicleType } from "../../../generated/prisma/browser";

export const VehicleValidation = {
    registerVehicle: z.object({
        body: z.object({
            make: z.string().min(1, "Make is required"),
            model: z.string().min(1, "Model is required"),
            year: z.number().int().min(1900, "Invalid year"),
            licensePlate: z.string().min(1, "License plate is required"),
            type: z.nativeEnum(VehicleType),
            centerId: z.string().optional(), // If registering a fleet vehicle
        })
    }),
    updateVehicle: z.object({
        body: z.object({
            make: z.string().optional(),
            model: z.string().optional(),
            year: z.number().int().optional(),
            licensePlate: z.string().optional(),
        })
    })
};
