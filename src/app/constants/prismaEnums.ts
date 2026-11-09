export const Role = {
    CUSTOMER: "CUSTOMER",
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    MECHANIC: "MECHANIC",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
    ACTIVE: "ACTIVE",
    BLOCKED: "BLOCKED",
    DELETED: "DELETED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const VehicleType = {
    RENTAL_FLEET: "RENTAL_FLEET",
    CUSTOMER_OWNED: "CUSTOMER_OWNED",
} as const;

export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const ServiceType = {
    WORKSHOP: "WORKSHOP",
    DOORSTEP: "DOORSTEP",
} as const;

export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const RequestStatus = {
    PENDING: "PENDING",
    ACCEPTED: "ACCEPTED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED_PENDING_REVIEW: "COMPLETED_PENDING_REVIEW",
    DONE: "DONE",
    COMPLETED: "COMPLETED",
    REASSIGNMENT_REQUIRED: "REASSIGNMENT_REQUIRED",
    CANCELLED: "CANCELLED",
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const PaymentStatus = {
    PENDING: "PENDING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
