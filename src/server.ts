import { Server } from "http";
import app from "./app.js";
import { envVars } from "./app/config/env.js";
import { RentalBookingService } from "./app/module/rentalBooking/rentalBooking.service.js";

let server : Server;
let syncInterval: NodeJS.Timeout | null = null;

const bootstrap = async() => {
    try {
        // Initial sync of rental bookings whose returnDate has passed
        await RentalBookingService.syncExpiredRentalBookings();

        // Recurring background sync every 60 seconds
        syncInterval = setInterval(async () => {
            try {
                await RentalBookingService.syncExpiredRentalBookings();
            } catch (syncErr) {
                console.error("Periodic rental booking sync error:", syncErr);
            }
        }, 60 * 1000);

        server = app.listen(envVars.PORT, () => {
            console.log(`Server is running on http://localhost:${envVars.PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }   
}

if (!process.env.VERCEL) {
    bootstrap();
}

// SIGTERM signal handler
process.on("SIGTERM", () => {
    console.log("SIGTERM signal received. Shutting down server...");

    if (syncInterval) clearInterval(syncInterval);
    if (server) {
        server.close(() => {
            console.log("Server closed gracefully.");
            process.exit(1);
        });
    } 
    process.exit(1);
});

// SIGINT signal handler
process.on("SIGINT", () => {
    console.log("SIGINT signal received. Shutting down server...");

    if (syncInterval) clearInterval(syncInterval);
    if (server) {
        server.close(() => {
            console.log("Server closed gracefully.");
            process.exit(1);
        });
    }
    process.exit(1);
});

// uncaught exception handler
process.on('uncaughtException', (error) => {
    console.log("Uncaught Exception Detected... Shutting down server", error);

    if (server) {
        server.close(() => {
            process.exit(1);
        });
    }
    process.exit(1);
});

process.on("unhandledRejection", (error) => {
    console.log("Unhandled Rejection Detected... Shutting down server", error);

    if (server) {
        server.close(() => {
            process.exit(1);
        });
    }
    process.exit(1);
});
