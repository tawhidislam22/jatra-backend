import z from "zod";
import { ServiceType, RequestStatus } from "../../../generated/prisma/browser";

export const ServiceRequestValidation = {
    createRequest: z.object({
        body: z.object({
            serviceType: z.nativeEnum(ServiceType),
            scheduledDate: z.string({ required_error: "Scheduled date is required" }).transform(str => new Date(str)),
            issueDescription: z.string().min(1, "Issue description is required"),
            vehicleId: z.string({ required_error: "Vehicle ID is required" }),
            centerId: z.string({ required_error: "Center ID is required" }),
        })
    }),
    assignMechanic: z.object({
        body: z.object({
            mechanicId: z.string({ required_error: "Mechanic ID is required" }),
        })
    }),
    updateStatus: z.object({
        body: z.object({
            status: z.nativeEnum(RequestStatus)
        })
    })
};
