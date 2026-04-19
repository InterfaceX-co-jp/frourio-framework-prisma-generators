/**
 * View-driven DTO generation spec types.
 *
 * A spec file describes named "views" per Prisma model. Each view declares a
 * Prisma `select` shape that the generator will use to emit a view type, a DTO
 * type, and a mapper/repository methods for that view.
 *
 * Later phases extend {@link ViewSpec} with `transforms`, `computed`, and `raw`
 * escape hatches. Phase 1 only consumes `select`.
 */

export type ViewSpecSelect = Record<string, unknown>;

export type ViewSpec = {
  select: ViewSpecSelect;
};

export type ModelViewsSpec = {
  [viewName: string]: ViewSpec;
};

export type ViewsSpec = {
  [modelName: string]: ModelViewsSpec;
};
