/**
 * View-driven DTO generation spec types.
 *
 * A spec file describes named "views" per Prisma model. Each view declares a
 * Prisma `select` shape plus optional `transforms` that the generator uses to
 * emit a view type, a DTO type, and a mapper/repository methods for that view.
 */

export type ViewSpecSelect = Record<string, unknown>;

/** Function transform: receives the raw DB value, returns the DTO value. */
export type TransformFn<TIn = never, TOut = unknown> = (v: TIn) => TOut;

/**
 * Static map transform — sugar for simple enum→label mappings.
 * e.g. `{ ABSENT: "お休み", SCHEDULED: "予定" }`
 */
export type TransformStaticMap = Record<string, string>;

export type TransformValue<TIn = never, TOut = unknown> =
  | TransformFn<TIn, TOut>
  | TransformStaticMap;

/** Computed field: adds a new property derived from the full row. */
export type ComputedFieldDefinition<TRow = never, TResult = unknown> = {
  /** Function that derives the value from the raw DB row. */
  from: (v: TRow) => TResult;
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
 *
 * Type parameters:
 * - TArgs: shape of the args object passed to `raw`
 * - TRow:  shape returned by `raw` (input to `map`)
 * - TDto:  shape returned by `map` (the final DTO)
 */
export type RawViewSpec<TArgs = unknown, TRow = unknown, TDto = unknown> = {
  raw: (prisma: unknown, args: TArgs) => Promise<TRow | null>;
  map: (row: TRow) => TDto;
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

export type FieldBaseConfig = {
  /** Exclude field from all DTOs (equivalent to `@dto.hide`). */
  hide?: boolean;
  /** Include nested relation as full DTO (equivalent to `@dto(nested: true)`). */
  nested?: boolean;
  /** Static enum→label map (equivalent to `@dto.map({...})`). */
  map?: Record<string, string>;
  /** JSON field TypeScript type (equivalent to `@json(type: [T])`). */
  jsonType?: string;
};

export type ModelBaseProfileConfig = {
  name: string;
  pick?: string[];
  omit?: string[];
};

export type ModelBaseConfig = {
  fields?: Record<string, FieldBaseConfig>;
  profiles?: ModelBaseProfileConfig[];
};

export type ModelDef<TName extends string = string> = {
  readonly _modelName: TName;
  readonly _views: ModelViewsSpec;
  readonly _base?: ModelBaseConfig;
};

/**
 * The spec object returned by `registerModels` and `loadSpec`.
 * Carries both view definitions and base model configuration.
 */
export type LoadedSpec = {
  readonly _type: "LoadedSpec";
  readonly views: ViewsSpec;
  readonly base: { readonly [modelName: string]: ModelBaseConfig };
};
