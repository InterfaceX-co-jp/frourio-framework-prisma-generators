import { GeneratorOptions } from '@prisma/generator-helper';
import Transformer from './transformer';

export async function generate(options: GeneratorOptions) {
  try {
    const models = options.dmmf.datamodel.models;

    const t = new Transformer({
      models,
    });

    await t.transform();
  } catch (e) {
    console.error(e);
  }
}
