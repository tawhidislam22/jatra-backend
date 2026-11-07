import { Role } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
    try {
        const isSuperAdminExist = await prisma.user.findFirst({
            where: {
                role: Role.ADMIN
            }
        });

        if (isSuperAdminExist) {
            console.log("Admin already exists. Skipping seeding.");
            return;
        }

        const existingEmailUser = await prisma.user.findUnique({
            where: {
                email: envVars.SUPER_ADMIN_EMAIL
            }
        });

        if (existingEmailUser) {
            console.log("A user with the admin email already exists. Promoting them to admin.");
            await prisma.user.update({
                where: { email: envVars.SUPER_ADMIN_EMAIL },
                data: { role: Role.ADMIN, emailVerified: true }
            });
            console.log("Existing user promoted to Admin.");
            return;
        }

        const superAdminUser = await auth.api.signUpEmail({
            body: {
                email: envVars.SUPER_ADMIN_EMAIL,
                password: envVars.SUPER_ADMIN_PASSWORD,
                name: "Admin",
                role: Role.ADMIN,
                needPasswordChange: false,
                rememberMe: false,
            }
        });

        if (superAdminUser?.user) {
            await prisma.user.update({
                where: {
                    id: superAdminUser.user.id
                },
                data: {
                    role: Role.ADMIN,
                    emailVerified: true,
                }
            });
            console.log("Admin Created: ", superAdminUser.user.email);
        }
    } catch (error) {
        console.error("Error seeding admin: ", error);
    }
};