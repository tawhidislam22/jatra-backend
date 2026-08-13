import z from "zod";
import { RequestStatus } from "../../../generated/prisma/browser";

export const EmergencyAssistanceValidation = {
    requestAssistance: z.object({
        body: z.object({
            latitude: z.number({ required_error: "Latitude is required" }),
            longitude: z.number({ required_error: "Longitude is required" }),
            issueDescription: z.string().min(1, "Issue description is required"),
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
