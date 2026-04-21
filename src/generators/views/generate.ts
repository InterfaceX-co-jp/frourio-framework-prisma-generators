import path from "path";
import type { DMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../utils/types";
import type { ViewsSpec } from "../../spec/types";
import { ViewsTransformer } from "./transformer";

export async function generateViews(args: {
  models: ReadonlyDeep<DMMF.Model[]>;
  spec: ViewsSpec;
  modelOutputPath: string;
}) {
  const viewsOutputPath = path.join(args.modelOutputPath, "..", "views");
  const transformer = new ViewsTransformer({
    models: args.models,
    spec: args.spec,
    outputPath: viewsOutputPath,
  });
  await transformer.transform();
}
