import { EnvValue, GeneratorOptions } from "@prisma/generator-helper";
import Transformer from "./transformer";
import { parseEnvValue } from "@prisma/internals";
import removeDir from "../utils/removeDir";
import fs from "fs";
import path from "path";

export async function generate(options: GeneratorOptions) {
  try {
    const models = options.dmmf.datamodel.models;

    const t = new Transformer({
      models,
    });

    if (options.generator.output) {
      const parsedPath = parseEnvValue(options.generator.output as EnvValue);
      t.setOutputPath({ path: parsedPath });

      const parsedAdditionalTypePath = options.generator.config
        .additionalTypePath as string | undefined;

      if (parsedAdditionalTypePath) {
        const absolutePath = path.join(
          options.schemaPath,
          "..",
          parsedAdditionalTypePath,
        );

        const relativePath = path.relative(parsedPath, absolutePath);

        t.setAdditionalTypePath({
          path: relativePath,
        });
      }

      if (fs.existsSync(parsedPath)) {
        await removeDir(parsedPath, true);
      } else {
        fs.mkdirSync(parsedPath, { recursive: true });
      }
    }

    await t.transform();
  } catch (e) {
    console.error(e);
  }
}
