import { camelCase } from "change-case-all";

/**
 * Normalizes a Prisma/schema field identifier to the camelCase name used in
 * generated model classes and dto.config.ts.
 *
 * Examples: `external_id` → `externalId`, `phoneNumber` → `phoneNumber`
 */
export const normalizeFieldName = (name: string): string => camelCase(name);
