import { camelCase } from "change-case-all";

/**
 * Normalizes a Prisma/schema field identifier to the camelCase name used in
 * generated model classes and dto.config.ts.
 *
 * Examples: `user_id` → `userId`, `phoneNumber` → `phoneNumber`
 */
export const normalizeFieldName = (name: string): string => camelCase(name);
