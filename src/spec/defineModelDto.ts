import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ModelDef,
  ModelBaseConfig,
  ModelViewsSpec,
  TransformFn,
  TransformStaticMap,
  ComputedFieldDefinition,
} from "./types";

type ModelSelect<TName extends Prisma.ModelName> = NonNullable<
  Prisma.TypeMap["model"][TName]["operations"]["findFirst"]["args"]["select"]
>;

/** Scalar-only row payload for a given model. */
type ModelScalars<TName extends Prisma.ModelName> =
  Prisma.TypeMap["model"][TName]["payload"]["scalars"];

/**
 * Transform map typed per scalar field. Top-level keys are scalar field names
 * of the model, each with its value typed to the field's type. For nested
 * dot-paths (e.g. "students.attendance"), use a plain `Record<string, TransformValue>`.
 */
type TypedTransforms<TName extends Prisma.ModelName> = {
  [K in keyof ModelScalars<TName>]?:
    | TransformFn<ModelScalars<TName>[K], unknown>
    | TransformStaticMap;
};

type TypedSelectViewSpec<TName extends Prisma.ModelName> = {
  select: ModelSelect<TName>;
  transforms?: TypedTransforms<TName>;
  computed?: Record<string, ComputedFieldDefinition<ModelScalars<TName>>>;
};

/**
 * Typed raw view spec. `prisma` is typed as `PrismaClient`; `TArgs` / `TRow` /
 * `TDto` are inferred from the user's `raw` and `map` definitions.
 */
export type TypedRawViewSpec<TArgs = unknown, TRow = unknown, TDto = unknown> = {
  raw: (prisma: PrismaClient, args: TArgs) => Promise<TRow | null>;
  map: (row: TRow) => TDto;
};

type TypedModelViewsSpec<TName extends Prisma.ModelName> = Record<
  string,
  TypedSelectViewSpec<TName> | TypedRawViewSpec<any, any, any>
>;

export function defineModelDto<TName extends Prisma.ModelName>(
  name: TName,
  config: { views?: TypedModelViewsSpec<TName>; base?: ModelBaseConfig },
): ModelDef<TName> {
  return {
    _modelName: name,
    _views: (config.views ?? {}) as ModelViewsSpec,
    _base: config.base,
  };
}
