import { PrismaClient } from "@prisma/client";
export const prisma = globalThis.meowPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalThis.meowPrisma = prisma;
}
