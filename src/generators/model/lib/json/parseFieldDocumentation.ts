import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../../../utils/types";

export const parseFieldDocumentation = (args: {
  field: ReadonlyDeep<PrismaDMMF.Field>;
}) => {
  const documentation = args.field.documentation;

  if (documentation) {
    // use regexp to parse: @json(type: [T])
    const jsonType = documentation.match(/@json\(type: \[(.*)\]\)/)?.[1];

    return {
      type: {
        jsonType,
        hasJsonType: !!jsonType,
      },
    };
  }
};
