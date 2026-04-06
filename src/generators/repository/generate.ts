import { EnvValue, GeneratorOptions } from "@prisma/generator-helper";
import { parseEnvValue } from "@prisma/internals";
import removeDir from "../utils/removeDir";
import fs from "fs";
import path from "path";
import { generateBaseRepository } from "./generateBaseRepository";
import { RepositoryTransformer } from "./transformer";

export async function generate(options: GeneratorOptions) {
  try {
    const models = options.dmmf.datamodel.models;

    if (!options.generator.output) {
      throw new Error(
        "[Frourio Framework] Repository generator requires an output path.",
      );
    }

    const parsedPath = parseEnvValue(options.generator.output as EnvValue);

    const modelImportPath = (options.generator.config.modelPath as string) ?? "../model";

    // Resolve relative model import path from repository output to model output
    const absoluteModelPath = path.join(
      options.schemaPath,
      "..",
      modelImportPath,
    );
    const relativeModelPath = path.relative(parsedPath, absoluteModelPath);

    if (fs.existsSync(parsedPath)) {
      await removeDir(parsedPath, true);
    } else {
      fs.mkdirSync(parsedPath, { recursive: true });
    }

    await generateBaseRepository(parsedPath);

    const transformer = new RepositoryTransformer({
      models,
      outputPath: parsedPath,
      modelImportPath: relativeModelPath,
    });

    await transformer.transform();
  } catch (e) {
    console.error(e);
  }
}
