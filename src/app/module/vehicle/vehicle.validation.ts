import z from "zod";
import { VehicleType } from "../../constants/prismaEnums.js";

export const VehicleValidation = {
    registerVehicle: z.object({
        body: z.object({
            make: z.string().min(1, "Make is required").optional(),
            model: z.string().min(1, "Model is required").optional(),
            year: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
            licensePlate: z.string().min(1, "License plate is required").optional(),
            type: z.union([z.nativeEnum(VehicleType), z.string()]).optional(),
            pricePerDay: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
            centerId: z.string().optional(),
            features: z.union([z.array(z.string()), z.string()]).optional(),
            images: z.union([z.array(z.string()), z.string()]).optional(),
            data: z.string().optional(),
        })
    }),
    updateVehicle: z.object({
        body: z.object({
            make: z.string().optional(),
            model: z.string().optional(),
            year: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
            licensePlate: z.string().optional(),
            pricePerDay: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
            isAvailable: z.union([z.boolean(), z.string()]).optional().transform(val => typeof val === 'string' ? val === 'true' : val),
            features: z.union([z.array(z.string()), z.string()]).optional(),
            images: z.union([z.array(z.string()), z.string()]).optional(),
            data: z.string().optional(),
        })
    })
};
