import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { tokenUtils } from "../../utils/token";
import { UserStatus } from "../../../generated/prisma/enums";
import { jwtUtils } from "../../utils/jwt";
import { envVars } from "../../config/env";
import { JwtPayload } from "jsonwebtoken";
import { IChangePasswordPayload, ILoginUserPayload, IRegisterUserPayload } from "./auth.interface";




const registerUser = async(payload: IRegisterUserPayload) => {
    const { fullName, email, password, phone, role } = payload;
    const data = await auth.api.signUpEmail({
        body:{
            name: fullName,
            email,
            password,
            role: role || "CUSTOMER",
            status: "ACTIVE",
            needPasswordChange: false,
            isDeleted: false
        }
    });

    if(!data.user){
        throw new AppError(status.INTERNAL_SERVER_ERROR,"User registration failed")
    }

    // Update with additional fields
    await prisma.user.update({
        where: { id: data.user.id },
        data: {
            fullName,
            phone,
            role: role || "CUSTOMER"
        }
    });

    try{
        const accessToken = tokenUtils.getAccessToken({
            userId: data.user.id,
            role: data.user.role,
            name: data.user.name,
            email: data.user.email,
            status: data.user.status,
            isDeleted: data.user.isDeleted,
            emailVerified: data.user.emailVerified,
        });
        const refreshToken = tokenUtils.getRefreshToken({
            userId: data.user.id,
            role: data.user.role,
            name: data.user.name,
            email: data.user.email,
            status: data.user.status,
            isDeleted: data.user.isDeleted ,
            emailVerified: data.user.emailVerified,
        });

        return {
            ...data,
            accessToken,
            refreshToken
        }
    }catch(error:any){
        console.log("Error during token generation",error)
        await prisma.user.delete({
            where:{
                id:data.user.id
            }
        })
        throw error;
    }
}



const loginUser = async (payload: ILoginUserPayload) => {
    const { email, password } = payload;

    const data = await auth.api.signInEmail({
        body: {
            email,
            password,
        }
    })

    if (data.user.status === UserStatus.BLOCKED) {
        //throw new Error("User is blocked");

        throw new AppError(status.FORBIDDEN,"User is blocked")
    }

    if (data.user.isDeleted || data.user.status === UserStatus.DELETED) {
        //throw new Error("User is deleted");
        throw new AppError(status.NOT_FOUND,"User is deleted")
    }

    const accessToken = tokenUtils.getAccessToken({
        userId: data.user.id,
            role: data.user.role,
            name: data.user.name,
            email: data.user.email,
            status: data.user.status,
            isDeleted: data.user.isDeleted,
            emailVerified: data.user.emailVerified,
    });
    const refreshToken = tokenUtils.getRefreshToken({
        userId: data.user.id,
            role: data.user.role,
            name: data.user.name,
            email: data.user.email,
            status: data.user.status,
            isDeleted: data.user.isDeleted,
            emailVerified: data.user.emailVerified,
    });

    return {
        ...data,
        accessToken,
        refreshToken
    };

}

const getMe= async(user:any)=>{
    const userId=user.userId
    const isUserExists= await prisma.user.findUnique({
        where:{
            id:userId
        }
    })

    if(!isUserExists){
        throw new AppError(status.NOT_FOUND,"User not found")
    }

    return isUserExists
}

const getNewToken=async(refreshToken:string,sessionToken:string)=>{
    const isSessionTokenExists= await prisma.session.findUnique({
        where:{
            token:sessionToken,
            expiresAt:{
                gt:new Date()
            }
        },
        include:{
            user:true
        }
    })

    if(!isSessionTokenExists){
        throw new AppError(status.UNAUTHORIZED,"Unauthorized access! Session token is invalid or expired.")
    }

    const verifiedRefreshToken= jwtUtils.verifyToken(refreshToken,envVars.REFRESH_TOKEN_SECRET)

    if(!verifiedRefreshToken){
        throw new AppError(status.UNAUTHORIZED,"Unauthorized access! Refresh token is invalid or expired.")
    }

    const data= verifiedRefreshToken as JwtPayload

    const newAccessToken = tokenUtils.getAccessToken({
        userId: data.userId,
        role: data.role,
        name: data.name,
        email: data.email,
        status: data.status,
        isDeleted: data.isDeleted,
        emailVerified: data.emailVerified,
    });

    const newRefreshToken = tokenUtils.getRefreshToken({
        userId: data.userId,
        role: data.role,
        name: data.name,
        email: data.email,
        status: data.status,
        isDeleted: data.isDeleted,
        emailVerified: data.emailVerified,
    });

    const {token}= await prisma.session.update({
        where:{
            token:sessionToken
        },
        data:{
            token:sessionToken,
            expiresAt:new Date(Date.now() + 60*60*1000*24*7),
            updatedAt:new Date()
        }
    })

    return {
        accessToken : newAccessToken,
        refreshToken : newRefreshToken,
        sessionToken : token,
    }


}

const changePassword=async(payload:IChangePasswordPayload,sessionToken:string)=>{
    const session= await auth.api.getSession({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`,
        })
    })

    if(!session){
        throw new AppError(status.UNAUTHORIZED,"Unauthorized access! Session token is invalid or expired.")
    }

    const { currentPassword, newPassword } = payload;
    const result= await auth.api.changePassword({
        body:{
            currentPassword,
            newPassword
        },
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`,
        })
    })
    if(session.user.needPasswordChange){
        await prisma.user.update({
            where:{
                id:session.user.id
            },
            data:{
                needPasswordChange:false
            }
        })

    }

    const accessToken = tokenUtils.getAccessToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });
    
    return {
        ...result,
        accessToken,
        refreshToken
    }
}

const logoutUser=async(sessionToken:string)=>{
    
    const result= await auth.api.signOut({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`,
        })
    })
    return result
}

const verifyEmail=async(email:string,otp:string)=>{
    const result= await auth.api.verifyEmailOTP({
        body:{
            email,
            otp
        }
    })

    if(result.status && !result.user.emailVerified){
        await prisma.user.update({
            where:{
                id:result.user.id
            },
            data:{
                emailVerified:true
            }
        })

    }
}

const resendOTP = async (email: string) => {
    const isUserExists = await prisma.user.findUnique({
        where: { email }
    });

    if (!isUserExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (isUserExists.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email is already verified");
    }

    await auth.api.sendVerificationEmail({
        body: {
            email
        }
    });
}

const forgetPassword=async(email:string)=>{
    const isUserExists= await prisma.user.findUnique({
        where:{
            email:email
        }
    })
    if(!isUserExists){
        throw new AppError(status.NOT_FOUND,"User not found")
    }

    if(!isUserExists.emailVerified){
        throw new AppError(status.BAD_REQUEST,"Email is not verified. Please verify your email first.")
    }
    if(isUserExists.isDeleted || isUserExists.status===UserStatus.DELETED){
        throw new AppError(status.NOT_FOUND,"User not found")
    }

    await auth.api.requestPasswordResetEmailOTP({
        body:{
            email
        }
    })

}

const resetPassword=async(email:string,otp:string,newPassword:string)=>{
    const isUserExists= await prisma.user.findUnique({
        where:{
            email:email
        }
    })
    if(!isUserExists){
        throw new AppError(status.NOT_FOUND,"User not found")
    }

    if(!isUserExists.emailVerified){
        throw new AppError(status.BAD_REQUEST,"Email is not verified. Please verify your email first.")
    }
    if(isUserExists.isDeleted || isUserExists.status===UserStatus.DELETED){
        throw new AppError(status.NOT_FOUND,"User not found")
    }

    await auth.api.resetPasswordEmailOTP({
        body:{
            email,
            otp,
            password:newPassword
        }
    })

    if (isUserExists.needPasswordChange) {
        await prisma.user.update({
            where: {
                id: isUserExists.id,
            },
            data: {
                needPasswordChange: false,
            }
        })
    }

    await prisma.session.deleteMany({
        where: {
            userId: isUserExists.id,
        }
    })

    const loginResult = await loginUser({ email, password: newPassword });
    return loginResult;
}

const googleLoginSuccess=async(session:Record<string, any>)=>{
    const isUserExists= await prisma.user.findUnique({
        where:{
            id:session.user.id
        }
    })

    const accessToken = tokenUtils.getAccessToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
    });
    const refreshToken = tokenUtils.getRefreshToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
    });
    return {
        accessToken,
        refreshToken
    }
}

export const AuthService={
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
    googleLoginSuccess

}