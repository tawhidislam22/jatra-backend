import { VehicleType } from "../../../generated/prisma/browser";

export interface IRegisterVehicleRequest {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    type: VehicleType;
    centerId?: string;
}

export interface IUpdateVehicleRequest {
    make?: string;
    model?: string;
    year?: number;
    licensePlate?: string;
}

export interface IVehicleFilterQuery {
    type?: VehicleType;
    centerId?: string;
}
