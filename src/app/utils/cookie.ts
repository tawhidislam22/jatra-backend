import { AppRequest, AppResponse } from "../interfaces/http.interface.js";

type CookieOptions = Record<string, any>;

const setCookie = (res: AppResponse, key: string, value: string, options: CookieOptions) => {
    res.cookie(key, value, options);
}

const getCookie = (req: AppRequest, key: string) => {
    return req.cookies[key];
}

const clearCookie = (res: AppResponse, key: string, options: CookieOptions) => {
    res.clearCookie(key, options);
}

export const CookieUtils = {
    setCookie,
    getCookie,
    clearCookie,
}
