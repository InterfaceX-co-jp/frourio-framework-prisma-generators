import { EnvValue, GeneratorOptions } from "@prisma/generator-helper";
import Transformer from "./transformer";
import { parseEnvValue } from "@prisma/internals";
import removeDir from "../utils/removeDir";

export async function generate(options: GeneratorOptions) {
  if (!options.generator.output) {
    throw new Error(
      `The 'output' field in the 'generator' section of the Prisma schema is required.`,
    );
  }

  try {
    const models = options.dmmf.datamodel.models;

    const t = new Transformer({
      models,
    });

    const parsedPath = parseEnvValue(options.generator.output as EnvValue);

    t.setOutputPath({ path: parsedPath });

    await cascadeDeleteDirectory({
      path: parsedPath,
    });

    await t.transform();
  } catch (e) {
    console.error(e);
  }
}

const cascadeDeleteDirectory = (args: { path: string }) => {
  return removeDir(args.path, false);
};
