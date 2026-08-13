import { NextFunction, Request, Response } from "express";
import z from "zod";

export const validateRequest = (zodSchema: z.ZodObject<any, any, any>) => {
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
        if (parsedResult.data.body) req.body = parsedResult.data.body;
        if (parsedResult.data.query) req.query = parsedResult.data.query;
        if (parsedResult.data.params) req.params = parsedResult.data.params;
        if (parsedResult.data.cookies) req.cookies = parsedResult.data.cookies;

        next();
    }
}