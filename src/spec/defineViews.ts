import type { Prisma } from "@prisma/client";
import type { ModelViewsSpec } from "./types";

/**
 * Identity helper used in spec files to get editor completion and type
 * inference for the {@link ViewsSpec} shape. It returns its input verbatim at
 * runtime so the spec object stays a plain data value.
 *
 * Top-level keys are constrained to `Prisma.ModelName` so typos in model
 * names surface as type errors.
 */
export function defineViews<
  T extends { [K in Prisma.ModelName]?: ModelViewsSpec },
>(spec: T): T {
  return spec;
}
