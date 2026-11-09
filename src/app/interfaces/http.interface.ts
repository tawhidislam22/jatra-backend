export type AppNextFunction = (error?: unknown) => void;

export interface AppRequest {
    params: Record<string, any>;
    query: Record<string, any>;
    body: any;
    cookies: Record<string, any>;
    headers: Record<string, any>;
    user: any;
    originalUrl: string;
    file?: any;
    files?: any;
    [key: string]: any;
}

export interface AppResponse {
    status: (code: number) => AppResponse;
    json: (body?: any) => AppResponse;
    send: (body?: any) => AppResponse;
    cookie: (key: string, value: string, options?: Record<string, any>) => AppResponse;
    clearCookie: (key: string, options?: Record<string, any>) => AppResponse;
    setHeader: (name: string, value: string | number | readonly string[]) => AppResponse;
    redirect: (url: string) => void;
    type: (contentType: string) => AppResponse;
    [key: string]: any;
}
