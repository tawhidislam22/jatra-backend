/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppNextFunction, AppRequest, AppResponse } from "../interfaces/http.interface";

type AsyncRequestHandler = (req: AppRequest, res: AppResponse, next: AppNextFunction) => unknown | Promise<unknown>;

export const catchAsync = (fn: AsyncRequestHandler) => {
    return async (req: AppRequest, res: AppResponse, next: AppNextFunction) => {
        try {
            await fn(req, res, next);
        } catch (error: any) {
            next(error);
        }
    }
}
