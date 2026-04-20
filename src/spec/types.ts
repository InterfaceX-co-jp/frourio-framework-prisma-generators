/**
 * View-driven DTO generation spec types.
 *
 * A spec file describes named "views" per Prisma model. Each view declares a
 * Prisma `select` shape plus optional `transforms` that the generator uses to
 * emit a view type, a DTO type, and a mapper/repository methods for that view.
 */

export type ViewSpecSelect = Record<string, unknown>;

/** Function transform: receives the raw DB value, returns the DTO value. */

export type TransformFn = (v: any) => unknown;

/**
 * Static map transform — sugar for simple enum→label mappings.
 * e.g. `{ ABSENT: "お休み", SCHEDULED: "予定" }`
 */
export type TransformStaticMap = Record<string, string>;

export type TransformValue = TransformFn | TransformStaticMap;

/** Computed field: adds a new property derived from the full row. */
export type ComputedFieldDefinition = {
  /** TypeScript type of the computed value (e.g. `"string"`, `"number"`). */
  type: string;
  /** Function that derives the value from the raw DB row. */
  from: (v: any) => unknown;
};

export type SelectViewSpec = {
  select: ViewSpecSelect;
  /**
   * Field-level transforms keyed by dot-path relative to the view root.
   * e.g. `"students.attendance"` transforms the `attendance` field inside each
   * element of the `students` array.
   */
  transforms?: Record<string, TransformValue>;
  /**
   * Computed fields added to the DTO (not present in select).
   * Each entry receives the full row and returns a derived value.
   */
  computed?: Record<string, ComputedFieldDefinition>;
};

/**
 * Raw view: bypasses select-based generation. The `raw` function executes an
 * arbitrary Prisma query, and `map` converts the result to the DTO. DTO type
 * is inferred from `map`'s return type.
 */
export type RawViewSpec = {
  raw: (prisma: any, args: any) => Promise<any>;
  map: (row: any) => any;
};

export type ViewSpec = SelectViewSpec | RawViewSpec;

export function isRawViewSpec(spec: ViewSpec): spec is RawViewSpec {
  return "raw" in spec && "map" in spec;
}

export type ModelViewsSpec = {
  [viewName: string]: ViewSpec;
};

export type ViewsSpec = {
  [modelName: string]: ModelViewsSpec;
};
