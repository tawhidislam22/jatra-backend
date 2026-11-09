import z from "zod";
import { RequestStatus } from "../../constants/prismaEnums";

export const EmergencyAssistanceValidation = {
    requestAssistance: z.object({
        body: z.object({
            latitude: z.number(),
            longitude: z.number(),
            issueDescription: z.string().min(1, "Issue description is required"),
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
