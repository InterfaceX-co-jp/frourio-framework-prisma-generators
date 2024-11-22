import type {
  DMMF as PrismaDMMF,
  ReadonlyDeep,
} from "@prisma/generator-helper";

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
