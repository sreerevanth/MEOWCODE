import { PrismaClient } from "@prisma/client";

declare global {
  var meowPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.meowPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.meowPrisma = prisma;
}

export type { PrismaClient };
