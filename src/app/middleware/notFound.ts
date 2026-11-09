import status from "http-status";
import { AppRequest, AppResponse } from "../interfaces/http.interface";

export const notFound = (req: AppRequest, res: AppResponse) => {
    res.status(status.NOT_FOUND).json({
        success: false,
        message: `Route ${req.originalUrl} Not Found`,
    })
}
