import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import compression from "compression";
import path from "path";
import qs from "qs";
import { envVars } from "./app/config/env.js";
import { AppRequest, AppResponse } from "./app/interfaces/http.interface.js";
import { auth } from "./app/lib/auth.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { notFound } from "./app/middleware/notFound.js";
import { IndexRoutes } from "./app/routes/index.js";
import { PaymentController } from "./app/module/payment/payment.controller.js";
import { perfLoggerMiddleware } from "./app/middleware/perfLogger.js";

const app = express() as any;
app.set("query parser", (str : string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), `src/app/templates`));

app.post("/webhook", express.raw({ type: "application/json" }), PaymentController.handleStripeWebhookEvent);

const allowedOrigins = [
    envVars.FRONTEND_URL,
    envVars.BETTER_AUTH_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://jatra-frontend.vercel.app",
    "https://jatra-backend.vercel.app"
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // Allow localhost and 127.0.0.1 on any port
        if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        // Allow any Vercel domain or configured origins
        if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
};

app.use(cors(corsOptions));
app.use(compression());
app.use(perfLoggerMiddleware);

app.all(["/api/auth", "/api/auth/*path"], toNodeHandler(auth));

// Middleware to parse request bodies
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/v1", IndexRoutes);

// Basic route
app.get('/', async (req: AppRequest, res: AppResponse) => {
    res.status(201).json({
        success: true,
        message: 'API is working',
    });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
