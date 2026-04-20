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

export type ViewSpec = {
  select: ViewSpecSelect;
  /**
   * Field-level transforms keyed by dot-path relative to the view root.
   * e.g. `"students.attendance"` transforms the `attendance` field inside each
   * element of the `students` array.
   */
  transforms?: Record<string, TransformValue>;
};

export type ModelViewsSpec = {
  [viewName: string]: ViewSpec;
};

export type ViewsSpec = {
  [modelName: string]: ModelViewsSpec;
};
