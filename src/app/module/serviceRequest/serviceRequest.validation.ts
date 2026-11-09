import z from "zod";
import { ServiceType, RequestStatus } from "../../constants/prismaEnums";

export const ServiceRequestValidation = {
    createRequest: z.object({
        body: z.object({
            serviceType: z.nativeEnum(ServiceType),
            scheduledDate: z.string().min(1, "Scheduled date is required").transform(str => new Date(str)),
            issueDescription: z.string().min(1, "Issue description is required"),
            vehicleId: z.string().min(1, "Vehicle ID is required"),
            centerId: z.string().min(1, "Center ID is required"),
        })
    }),
    assignMechanic: z.object({
        body: z.object({
            mechanicId: z.string().min(1, "Mechanic ID is required"),
        })
    }),
    updateStatus: z.object({
        body: z.object({
            status: z.nativeEnum(RequestStatus)
        })
    })
};
