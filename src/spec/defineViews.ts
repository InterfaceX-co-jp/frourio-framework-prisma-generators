import type { ViewsSpec } from "./types";

/**
 * Identity helper used in spec files to get editor completion and type
 * inference for the {@link ViewsSpec} shape. It returns its input verbatim at
 * runtime so the spec object stays a plain data value.
 */
export function defineViews<T extends ViewsSpec>(spec: T): T {
  return spec;
}
