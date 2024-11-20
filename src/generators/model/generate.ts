import { EnvValue, GeneratorOptions } from "@prisma/generator-helper";
import Transformer from "./transformer";
import { parseEnvValue } from "@prisma/internals";
import removeDir from "../utils/removeDir";

export async function generate(options: GeneratorOptions) {
  try {
    const models = options.dmmf.datamodel.models;

    const t = new Transformer({
      models,
    });

    if (options.generator.output) {
      const parsedPath = parseEnvValue(options.generator.output as EnvValue);

      t.setOutputPath({ path: parsedPath });

      await removeDir(parsedPath, true);
    }

    await t.transform();
  } catch (e) {
    console.error(e);
  }
}
