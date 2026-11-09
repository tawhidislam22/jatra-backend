import dotenv from "dotenv"

dotenv.config()

interface EnvConfig{
    NODE_ENV: string;
    PORT: string;
    DATABASE_URL:string;
    BETTER_AUTH_SECRET:string;
    BETTER_AUTH_URL:string;
    ACCESS_TOKEN_SECRET:string;
    REFRESH_TOKEN_SECRET:string;
    ACCESS_TOKEN_EXPIRES_IN:string;
    REFRESH_TOKEN_EXPIRES_IN:string;
    BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: string;
    BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: string;
    EMAIL_SENDER:{
        SMTP_USER: string;
        SMTP_PASS: string;
        SMTP_HOST: string;
        SMTP_PORT: string;
        SMTP_FROM: string;
    },
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CALLBACK_URL: string;
    FRONTEND_URL: string;
    CLOUDINARY:{
        CLOUDINARY_CLOUD_NAME: string;
        CLOUDINARY_API_KEY: string;
        CLOUDINARY_API_SECRET: string;
    },
    STRIPE:{
        STRIPE_SECRET_KEY: string;
        STRIPE_WEBHOOK_SECRET: string;
    },
        SUPER_ADMIN_EMAIL: string;
        SUPER_ADMIN_PASSWORD: string;


}

const env = (key: string, fallback = ""): string => {
    const value = process.env[key];
    if (value) return value;

    if (process.env.NODE_ENV === "production") {
        console.warn(`Missing environment variable: ${key}`);
    }

    return fallback;
}

const loadEnvVariables=():EnvConfig=>{
    return{
        NODE_ENV: env("NODE_ENV", "development"),
        PORT: env("PORT", "5000"),
        DATABASE_URL: env("DATABASE_URL", "postgresql://localhost:5432/jatra"),
        BETTER_AUTH_SECRET: env("BETTER_AUTH_SECRET", "missing-better-auth-secret-change-me"),
        BETTER_AUTH_URL: env("BETTER_AUTH_URL", "http://localhost:5000"),
        ACCESS_TOKEN_SECRET: env("ACCESS_TOKEN_SECRET", "missing-access-token-secret-change-me"),
        REFRESH_TOKEN_SECRET: env("REFRESH_TOKEN_SECRET", "missing-refresh-token-secret-change-me"),
        ACCESS_TOKEN_EXPIRES_IN: env("ACCESS_TOKEN_EXPIRES_IN", "1d"),
        BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: env("BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN", "86400"),
        BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: env("BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE", "86400"),
        EMAIL_SENDER: {
            SMTP_USER: env("EMAIL_SENDER_SMTP_USER"),
            SMTP_PASS: env("EMAIL_SENDER_SMTP_PASS"),
            SMTP_HOST: env("EMAIL_SENDER_SMTP_HOST", "smtp.gmail.com"),
            SMTP_PORT: env("EMAIL_SENDER_SMTP_PORT", "465"),
            SMTP_FROM: env("EMAIL_SENDER_SMTP_FROM"),
        },
        REFRESH_TOKEN_EXPIRES_IN: env("REFRESH_TOKEN_EXPIRES_IN", "7d"),
        GOOGLE_CLIENT_ID: env("GOOGLE_CLIENT_ID"),
        GOOGLE_CLIENT_SECRET: env("GOOGLE_CLIENT_SECRET"),
        GOOGLE_CALLBACK_URL: env("GOOGLE_CALLBACK_URL"),
        FRONTEND_URL: env("FRONTEND_URL", "http://localhost:3000"),
        CLOUDINARY: {
            CLOUDINARY_CLOUD_NAME: env("CLOUDINARY_CLOUD_NAME"),
            CLOUDINARY_API_KEY: env("CLOUDINARY_API_KEY"),
            CLOUDINARY_API_SECRET: env("CLOUDINARY_API_SECRET"),
        },
        STRIPE: {
            STRIPE_SECRET_KEY: env("STRIPE_SECRET_KEY"),
            STRIPE_WEBHOOK_SECRET: env("STRIPE_WEBHOOK_SECRET"),
        },
        SUPER_ADMIN_EMAIL: env("SUPER_ADMIN_EMAIL"),
        SUPER_ADMIN_PASSWORD: env("SUPER_ADMIN_PASSWORD"),
        
        
    }
}

export const envVars=loadEnvVariables()


