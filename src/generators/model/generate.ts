import { EnvValue, GeneratorOptions } from "@prisma/generator-helper";
import Transformer from "./transformer";
import { parseEnvValue } from "@prisma/internals";

export async function generate(options: GeneratorOptions) {
  try {
    const models = options.dmmf.datamodel.models;

    const t = new Transformer({
      models,
    });

    setupOutputPath({
      envValue: options.generator.output as EnvValue,
      transformer: t,
    });

    await t.transform();
  } catch (e) {
    console.error(e);
  }
}

const setupOutputPath = (args: {
  envValue: EnvValue;
  transformer: Transformer;
}) => {
  const parsed = parseEnvValue(args.envValue);

  args.transformer.setOutputPath({ path: parsed });
};
