/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { Role, UserStatus } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import { CookieUtils } from "../utils/cookie";
import { jwtUtils } from "../utils/jwt";

export const checkAuth = (...authRoles: Role[]) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        let user: any = null;

        // 1. Session Token Verification (Better-Auth Cookie)
        const sessionCookie = CookieUtils.getCookie(req, "better-auth.session_token");
        if (sessionCookie) {
            const sessionExists = await prisma.session.findFirst({
                where: {
                    token: sessionCookie,
                    expiresAt: {
                        gt: new Date(),
                    }
                },
                include: {
                    user: true,
                }
            });

            if (sessionExists && sessionExists.user) {
                user = sessionExists.user;

                const now = new Date();
                const expiresAt = new Date(sessionExists.expiresAt);
                const createdAt = new Date(sessionExists.createdAt);

                const sessionLifeTime = expiresAt.getTime() - createdAt.getTime();
                const timeRemaining = expiresAt.getTime() - now.getTime();
                const percentRemaining = (timeRemaining / sessionLifeTime) * 100;

                if (percentRemaining < 20) {
                    res.setHeader('X-Session-Refresh', 'true');
                    res.setHeader('X-Session-Expires-At', expiresAt.toISOString());
                    res.setHeader('X-Time-Remaining', timeRemaining.toString());
                }
            }
        }

        // 2. Access Token Verification (JWT from Cookie or Bearer Header)
        if (!user) {
            let accessToken = CookieUtils.getCookie(req, 'accessToken');

            if (!accessToken && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
                accessToken = req.headers.authorization.split(" ")[1];
            }

            if (accessToken) {
                const verifiedToken = jwtUtils.verifyToken(accessToken, envVars.ACCESS_TOKEN_SECRET);
                if (verifiedToken.success && verifiedToken.data?.userId) {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: verifiedToken.data.userId }
                    });
                    if (dbUser) {
                        user = dbUser;
                    }
                }
            }
        }

        if (!user) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! No valid session or token provided.');
        }

        if (user.status === UserStatus.BLOCKED || user.status === UserStatus.DELETED) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! User is not active.');
        }

        if (user.isDeleted) {
            throw new AppError(status.UNAUTHORIZED, 'Unauthorized access! User is deleted.');
        }

        // Check if role is authorized (ADMIN always has access, or role in authRoles)
        if (authRoles.length > 0) {
            const isAuthorized = authRoles.includes(user.role) || user.role === Role.ADMIN;
            if (!isAuthorized) {
                throw new AppError(status.FORBIDDEN, 'Forbidden access! You do not have permission to access this resource.');
            }
        }

        req.user = {
            userId: user.id,
            role: user.role,
            email: user.email,
        };

        next();
    } catch (error: any) {
        next(error);
    }
};