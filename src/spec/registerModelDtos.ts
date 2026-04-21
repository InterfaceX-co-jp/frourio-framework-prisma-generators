import type { LoadedSpec, ModelDef } from "./types";

export function registerModelDtos(models: ModelDef[]): LoadedSpec {
  const seen = new Set<string>();
  for (const m of models) {
    if (seen.has(m._modelName)) {
      throw new Error(
        `[Frourio Framework] registerModelDtos: duplicate model "${m._modelName}". Each model must appear only once.`,
      );
    }
    seen.add(m._modelName);
  }
  return {
    _type: "LoadedSpec",
    views: Object.fromEntries(models.map((m) => [m._modelName, m._views])),
    base: Object.fromEntries(
      models.filter((m) => m._base).map((m) => [m._modelName, m._base!]),
    ),
  };
}
