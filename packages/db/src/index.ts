import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export * from "./coa-default.js"; // ekstensi eksplisit: Node ESM type-stripping (prod VM)

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = g.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
