import z from "zod";

export const AutomotiveCenterValidation = {
    createCenter: z.object({
        body: z.object({
            name: z.string().min(1, "Name is required"),
            address: z.string().min(1, "Address is required"),
            phone: z.string().optional(),
            description: z.string().optional(),
            latitude: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : (val ?? 23.8103)),
            longitude: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : (val ?? 90.4125)),
            servicesOffered: z.union([z.array(z.string()), z.string()]).optional(),
            images: z.union([z.array(z.string()), z.string()]).optional(),
        })
    }),
    updateCenter: z.object({
        body: z.object({
            name: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
            description: z.string().optional(),
            latitude: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
            longitude: z.union([z.number(), z.string()]).optional().transform(val => typeof val === 'string' ? parseFloat(val) : val),
            servicesOffered: z.union([z.array(z.string()), z.string()]).optional(),
            images: z.union([z.array(z.string()), z.string()]).optional(),
        })
    }),
    addMechanic: z.object({
        body: z.object({
            mechanicId: z.string().optional(),
            name: z.string().optional(),
            fullName: z.string().optional(),
            email: z.string().email("Invalid email address").optional(),
            password: z.string().min(6, "Password must be at least 6 characters").optional(),
        }).refine((data) => !!data.mechanicId || !!(data.email && (data.name || data.fullName)), {
            message: "Either mechanicId or mechanic details (name and email) must be provided.",
        })
    })
};
