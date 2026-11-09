import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { envVars } from "../config/env.js";
import { recordDbQuery } from "./perfStorage.js";

// Ensure connection string uses sslmode=verify-full to prevent pg-connection-string security warning
const formatConnectionString = (url: string): string => {
    if (!url) return url;
    if (/sslmode=(require|prefer|verify-ca)/.test(url) && !url.includes("uselibpqcompat=true")) {
        return url.replace(/([?&])sslmode=(require|prefer|verify-ca)(?=&|$)/g, "$1sslmode=verify-full");
    }
    return url;
};

const connectionString = formatConnectionString(`${envVars.DATABASE_URL}`);

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
    pgPool?: pg.Pool;
};

const pool = globalForPrisma.pgPool || new pg.Pool({
    connectionString,
    max: 20, // Max concurrent connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
}

const adapter = new PrismaPg(pool);

const basePrisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export const prisma = (basePrisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }: any) {
                const start = performance.now();
                try {
                    return await query(args);
                } finally {
                    const duration = performance.now() - start;
                    recordDbQuery(model, operation, duration);
                }
            }
        }
    }
}) as unknown) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = basePrisma;
}
