import z from "zod";

export const AutomotiveCenterValidation = {
    createCenter: z.object({
        body: z.object({
            name: z.string().min(1, "Name is required"),
            address: z.string().min(1, "Address is required"),
            latitude: z.number({ required_error: "Latitude is required" }),
            longitude: z.number({ required_error: "Longitude is required" }),
            images: z.array(z.string()).optional(),
        })
    }),
    updateCenter: z.object({
        body: z.object({
            name: z.string().optional(),
            address: z.string().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            servicesOffered: z.array(z.string()).optional(),
            images: z.array(z.string()).optional(),
        })
    }),
    addMechanic: z.object({
        body: z.object({
            mechanicId: z.string({ required_error: "Mechanic ID is required" }),
        })
    })
};
