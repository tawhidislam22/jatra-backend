export interface ICreateCenterRequest {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface IUpdateCenterRequest {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
}
