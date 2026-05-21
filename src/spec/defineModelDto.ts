import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ModelDef,
  ModelBaseConfig,
  ModelViewsSpec,
  FieldBaseConfig,
  TransformFn,
  TransformStaticMap,
  TransformValue,
  ComputedFieldDefinition,
} from "./types";

type ModelSelect<TName extends Prisma.ModelName> = NonNullable<
  Prisma.TypeMap["model"][TName]["operations"]["findFirst"]["args"]["select"]
>;

/** Scalar-only row payload for a given model. */
type ModelScalars<TName extends Prisma.ModelName> =
  Prisma.TypeMap["model"][TName]["payload"]["scalars"];

/** Relation field names (objects in Prisma payload) as string union. */
type ModelRelationName<TName extends Prisma.ModelName> = Extract<
  keyof Prisma.TypeMap["model"][TName]["payload"]["objects"],
  string
>;

/** All field names (scalars + relation objects) for a given model. */
type ModelFieldName<TName extends Prisma.ModelName> =
  | Extract<keyof ModelScalars<TName>, string>
  | ModelRelationName<TName>;

/**
 * Transform map typed per scalar field plus nested dot-paths under relations.
 * Top-level keys are scalar field names of the model. Nested dot-paths
 * (e.g. `"students.attendance"`) are accepted under any relation field name.
 */
type TypedTransforms<TName extends Prisma.ModelName> = {
  [K in keyof ModelScalars<TName>]?:
    | TransformFn<ModelScalars<TName>[K], unknown>
    | TransformStaticMap;
} & {
  [P in `${ModelRelationName<TName>}.${string}`]?: TransformValue;
};

/** Per-model `profiles[]` entry with `pick`/`omit` typed to model field names. */
export type TypedModelBaseProfileConfig<TName extends Prisma.ModelName> = {
  name: string;
  pick?: ModelFieldName<TName>[];
  omit?: ModelFieldName<TName>[];
};

/** Per-model `base` config with `fields` keys typed to model field names. */
export type TypedModelBaseConfig<TName extends Prisma.ModelName> = {
  fields?: Partial<Record<ModelFieldName<TName>, FieldBaseConfig>>;
  profiles?: TypedModelBaseProfileConfig<TName>[];
};

/**
 * Typed raw view spec. `prisma` is typed as `PrismaClient`; `TArgs` / `TRow` /
 * `TDto` are inferred from the user's `raw` and `map` definitions.
 */
export type TypedRawViewSpec<
  TArgs = unknown,
  TRow = unknown,
  TDto = unknown,
> = {
  raw: (prisma: PrismaClient, args: TArgs) => Promise<TRow | null>;
  map: (row: TRow) => TDto;
};

/**
 * Select-based view spec. Provides contextual typing for `select` (validated
 * against the model's Prisma select shape) and `transforms` (typed per scalar
 * field). `computed.from` receives `any` — per-view row narrowing requires a
 * dedicated helper (future enhancement).
 */
export type TypedSelectViewSpec<TName extends Prisma.ModelName> = {
  select: ModelSelect<TName>;
  transforms?: TypedTransforms<TName>;
  computed?: Record<string, ComputedFieldDefinition<any>>;
};

export function defineModelDto<TName extends Prisma.ModelName>(
  name: TName,
  config: {
    views?: Record<
      string,
      TypedSelectViewSpec<TName> | TypedRawViewSpec<any, any, any>
    >;
    base?: TypedModelBaseConfig<TName>;
  },
): ModelDef<TName> {
  return {
    _modelName: name,
    _views: (config.views ?? {}) as ModelViewsSpec,
    _base: config.base as ModelBaseConfig | undefined,
  };
}
