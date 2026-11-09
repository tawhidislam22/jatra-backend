import { VehicleType } from "../../constants/prismaEnums.js";

export interface IRegisterVehicleRequest {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    type: VehicleType;
    centerId?: string;
    pricePerDay?: number;
    features?: string[];
    images?: string[];
}

export interface IUpdateVehicleRequest {
    make?: string;
    model?: string;
    year?: number;
    licensePlate?: string;
    pricePerDay?: number;
    isAvailable?: boolean;
    features?: string[];
    images?: string[];
}

export interface IVehicleFilterQuery {
    type?: VehicleType;
    centerId?: string;
}
