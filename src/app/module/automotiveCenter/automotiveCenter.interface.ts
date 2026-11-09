export interface ICreateCenterRequest {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    phone?: string;
    description?: string;
    servicesOffered?: string[];
    customServices?: any;
    images?: string[];
}

export interface IUpdateCenterRequest {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    description?: string;
    servicesOffered?: string[];
    customServices?: any;
    images?: string[];
}
