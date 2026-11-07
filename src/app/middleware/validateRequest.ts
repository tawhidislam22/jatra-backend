import { NextFunction, Request, Response } from "express";
import z from "zod";

export const validateRequest = (zodSchema: z.ZodTypeAny) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.body.data) {
            try {
                req.body = JSON.parse(req.body.data);
            } catch (e) {
                // Ignore parse error, let Zod catch invalid formats
            }
        }

        const parsedResult = zodSchema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
            cookies: req.cookies,
        });

        if (!parsedResult.success) {
            return next(parsedResult.error);
        }

        // Only overwrite properties that were successfully parsed to avoid destroying the rest of req
        const parsedData = parsedResult.data as any;
        if (parsedData?.body) req.body = parsedData.body;
        if (parsedData?.query) req.query = parsedData.query;
        if (parsedData?.params) req.params = parsedData.params;
        if (parsedData?.cookies) req.cookies = parsedData.cookies;

        next();
    }
}