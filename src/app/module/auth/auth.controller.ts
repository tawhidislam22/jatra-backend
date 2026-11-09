import { AppRequest, AppResponse } from "../../interfaces/http.interface";
import status from "http-status";
import ms, { StringValue } from "ms";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CookieUtils } from "../../utils/cookie";
import { tokenUtils } from "../../utils/token";
import { AuthService } from "./auth.service";

const getSafeRedirectPath = (redirectPath?: string) => {
    if (!redirectPath) {
        return "/dashboard";
    }

    let decodedPath = redirectPath;
    try {
        decodedPath = decodeURIComponent(redirectPath);
    } catch {
        return "/dashboard";
    }
    const isValidRedirectPath = decodedPath.startsWith("/") && !decodedPath.startsWith("//");

    return isValidRedirectPath ? decodedPath : "/dashboard";
}

const getGoogleRedirectHtml = (betterAuthUrl: string, callbackURL: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jatra - Redirecting to Google...</title>
    <style>
        body {
            margin: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #0f172a;
            font-family: Arial, sans-serif;
            color: #ffffff;
        }
        .container { text-align: center; }
        .logo {
            font-size: 36px;
            font-weight: 900;
            letter-spacing: 2px;
            margin-bottom: 20px;
            color: #60a5fa;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255,255,255,0.1);
            border-left-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .text { font-size: 16px; color: #94a3b8; font-weight: 500; }
        .error { color: #ef4444; margin-top: 20px; font-weight: 500; }
    </style>
</head>
<body>
    <div class="container" id="content-container">
        <div class="logo">JATRA</div>
        <div class="spinner"></div>
        <div class="text">Connecting to Google securely...</div>
    </div>
    <script>
        (async () => {
            try {
                const response = await fetch(${JSON.stringify(`${betterAuthUrl}/api/auth/sign-in/social`)}, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        provider: "google",
                        callbackURL: ${JSON.stringify(callbackURL)}
                    })
                });

                const data = await response.json();

                if (data.url) {
                    window.location.href = data.url;
                    return;
                }

                document.getElementById("content-container").innerHTML =
                    '<div class="logo">JATRA</div><div class="error">Error connecting to Google. Please try again later.</div>';
            } catch (error) {
                document.getElementById("content-container").innerHTML =
                    '<div class="logo">JATRA</div><div class="error">Error connecting to Google. Please try again later.</div>';
            }
        })();
    </script>
</body>
</html>`;

const registerUser = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const maxAge = ms(envVars.ACCESS_TOKEN_EXPIRES_IN as StringValue);
        const payload = req.body;

        const result = await AuthService.registerUser(payload);

        const { accessToken, refreshToken, token, ...rest } = result

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, token as string);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "User registered successfully",
            data: {
                token,
                accessToken,
                refreshToken,
                ...rest,
            }
        })
    }
)

const loginUser = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const payload = req.body;
        const result = await AuthService.loginUser(payload);
        const { accessToken, refreshToken, token, ...rest } = result

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, token);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User logged in successfully",
            data: {
                token,
                accessToken,
                refreshToken,
                ...rest,

            },
        })
    }
)

const getMe = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const user = req.user;
        const result = await AuthService.getMe(user);

        // If the database user role has changed or center was assigned
        if (result && (result.role !== user.role || result.employedAtCenterId !== (user as any).employedAtCenterId)) {
            const centerInfo = result.employedAtCenter ? {
                id: result.employedAtCenter.id,
                name: result.employedAtCenter.name,
                address: result.employedAtCenter.address,
                phone: result.employedAtCenter.phone,
                rating: result.employedAtCenter.rating,
            } : undefined;

            const managedCenterInfo = result.managedCenter ? {
                id: result.managedCenter.id,
                name: result.managedCenter.name,
                address: result.managedCenter.address,
            } : undefined;

            const newAccessToken = tokenUtils.getAccessToken({
                userId: result.id,
                role: result.role,
                name: result.name,
                fullName: result.fullName || result.name,
                email: result.email,
                phone: result.phone,
                status: result.status,
                isDeleted: result.isDeleted,
                emailVerified: result.emailVerified,
                employedAtCenterId: result.employedAtCenterId,
                employedAtCenter: centerInfo,
                managedCenter: managedCenterInfo,
            });
            tokenUtils.setAccessTokenCookie(res, newAccessToken);
            (result as any).accessToken = newAccessToken;
        }

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User profile fetched successfully",
            data: result,
        })
    }
)

const getNewToken = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const refreshToken = req.cookies.refreshToken;
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        if (!refreshToken) {
            throw new AppError(status.UNAUTHORIZED, "Refresh token is missing");
        }
        const result = await AuthService.getNewToken(refreshToken, betterAuthSessionToken);

        const { accessToken, refreshToken: newRefreshToken, sessionToken } = result;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, newRefreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, sessionToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "New tokens generated successfully",
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                sessionToken,
            },
        });
    }
)

const changePassword = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const payload = req.body;
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];

        const result = await AuthService.changePassword(payload, betterAuthSessionToken);

        const { accessToken, refreshToken, token } = result;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, token as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password changed successfully",
            data: result,
        });
    }
)

const logoutUser = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        const result = await AuthService.logoutUser(betterAuthSessionToken);
        CookieUtils.clearCookie(res, 'accessToken', {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        CookieUtils.clearCookie(res, 'refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        CookieUtils.clearCookie(res, 'better-auth.session_token', {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User logged out successfully",
            data: result,
        });
    }
)

const verifyEmail = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const { email, otp } = req.body;
        await AuthService.verifyEmail(email, otp);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Email verified successfully",
        });
    }
)

const resendOTP = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const { email } = req.body;
        await AuthService.resendOTP(email);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Verification OTP sent to email successfully",
        });
    }
)

const forgetPassword = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const { email } = req.body;
        await AuthService.forgetPassword(email);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password reset OTP sent to email successfully",
        });
    }
)

const resetPassword = catchAsync(
    async (req: AppRequest, res: AppResponse) => {
        const { email, otp, newPassword } = req.body;
        const result = await AuthService.resetPassword(email, otp, newPassword);
        
        const { accessToken, refreshToken, token, ...rest } = result;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, token as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password reset successfully",
            data: {
                token,
                accessToken,
                refreshToken,
                ...rest
            }
        });
    }
)

// /api/v1/auth/login/google?redirect=/profile
const googleLogin = catchAsync((req: AppRequest, res: AppResponse) => {
    const redirectPath = getSafeRedirectPath(req.query.redirect as string | undefined);

    const encodedRedirectPath = encodeURIComponent(redirectPath);

    const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

    res.type("html").send(getGoogleRedirectHtml(envVars.BETTER_AUTH_URL, callbackURL));
})

const googleLoginSuccess = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const redirectPath = getSafeRedirectPath(req.query.redirect as string | undefined);

    const sessionToken = req.cookies["better-auth.session_token"];

    if(!sessionToken){
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=oauth_failed`);
    }

    const session = await auth.api.getSession({
        headers:{
            "Cookie" : `better-auth.session_token=${sessionToken}`
        }
    })

    if (!session) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_session_found`);
    }


    if(session && !session.user){
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_user_found`);
    }

    const result = await AuthService.googleLoginSuccess(session);

    const {accessToken, refreshToken} = result;

    tokenUtils.setAccessTokenCookie(res, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);

    const hash = new URLSearchParams({
        accessToken,
        redirect: redirectPath
    });

    res.redirect(`${envVars.FRONTEND_URL}/auth/google/callback#${hash.toString()}`);
})

const handleOAuthError = catchAsync((req: AppRequest, res: AppResponse) => {
    const error = req.query.error as string || "oauth_failed";
    res.redirect(`${envVars.FRONTEND_URL}/login?error=${error}`);
})

const setupPassword = catchAsync(async (req: AppRequest, res: AppResponse) => {
    const payload = req.body;
    const result = await AuthService.setupPassword(payload);
    const { accessToken, refreshToken, user } = result;

    tokenUtils.setAccessTokenCookie(res, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Password set and account activated successfully",
        data: {
            accessToken,
            refreshToken,
            user,
        }
    });
});

export const AuthController = {
    registerUser,
    loginUser,
    getMe,
    getNewToken,
    changePassword,
    logoutUser,
    verifyEmail,
    resendOTP,
    forgetPassword,
    resetPassword,
    setupPassword,
    googleLogin,
    googleLoginSuccess,
    handleOAuthError,
};
