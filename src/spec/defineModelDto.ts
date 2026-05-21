import type { Prisma, PrismaClient } from "@prisma/client";
import type { GetFindResult } from "@prisma/client/runtime/client";
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
 * Row type narrowed by the user's `select` shape. Includes selected relations
 * with their selected fields (recursively), so `computed.from` can access
 * relation data type-safely.
 */
type RowFromSelect<TName extends Prisma.ModelName, TSelect> = GetFindResult<
  Prisma.TypeMap["model"][TName]["payload"],
  { select: TSelect },
  {}
>;

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
export type TypedRawViewSpec<TArgs = unknown, TRow = unknown, TDto = unknown> = {
  raw: (prisma: PrismaClient, args: TArgs) => Promise<TRow | null>;
  map: (row: TRow) => TDto;
};

/**
 * Validates one view entry. For `select`-style views the user's select shape
 * `S` is inferred and threaded into `computed.from`'s row type.
 */
type ValidateView<TName extends Prisma.ModelName, V> = V extends {
  raw: any;
  map: any;
}
  ? TypedRawViewSpec<any, any, any>
  : V extends { select: infer S }
    ? S extends ModelSelect<TName>
      ? {
          select: S;
          transforms?: TypedTransforms<TName>;
          computed?: Record<
            string,
            ComputedFieldDefinition<RowFromSelect<TName, S>>
          >;
        }
      : never
    : never;

type ValidatedViews<TName extends Prisma.ModelName, TViews> = {
  [K in keyof TViews]: ValidateView<TName, TViews[K]>;
};

export function defineModelDto<
  TName extends Prisma.ModelName,
  TViews extends Record<string, unknown> = {},
>(
  name: TName,
  config: {
    views?: TViews & ValidatedViews<TName, TViews>;
    base?: TypedModelBaseConfig<TName>;
  },
): ModelDef<TName> {
  return {
    _modelName: name,
    _views: (config.views ?? {}) as ModelViewsSpec,
    _base: config.base as ModelBaseConfig | undefined,
  };
}
