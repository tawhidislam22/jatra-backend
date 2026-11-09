import z from "zod";
import { ServiceType, RequestStatus } from "../../constants/prismaEnums.js";

export const ServiceRequestValidation = {
    createRequest: z.object({
        body: z.object({
            serviceType: z.nativeEnum(ServiceType).optional().default(ServiceType.WORKSHOP),
            serviceName: z.string().optional(),
            scheduledDate: z.string().min(1, "Scheduled date is required"),
            issueDescription: z.string().optional(),
            vehicleId: z.string().min(1, "Vehicle ID is required"),
            centerId: z.string().min(1, "Center ID is required"),
            estimatedDuration: z.coerce.number().optional(),
            totalAmount: z.coerce.number().optional()
        })
    }),
    assignMechanic: z.object({
        body: z.object({
            mechanicId: z.string().min(1, "Mechanic ID is required"),
            notes: z.string().optional()
        })
    }),
    verifyCompletion: z.object({
        body: z.object({
            action: z.enum(["APPROVE", "REWORK"]),
            notes: z.string().optional(),
            newMechanicId: z.string().optional()
        })
    }),
    reopenForRework: z.object({
        body: z.object({
            reason: z.string().min(1, "Reason is required to reopen a job"),
            mechanicId: z.string().optional()
        })
    }),
    updateStatus: z.object({
        body: z.object({
            status: z.nativeEnum(RequestStatus)
        })
    })
};
