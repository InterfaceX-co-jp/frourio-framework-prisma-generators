import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../../../utils/types";
import type { DtoFieldAnnotation } from "./types";

export const parseFieldDtoAnnotation = (args: {
  field: ReadonlyDeep<PrismaDMMF.Field>;
}): DtoFieldAnnotation | undefined => {
  const documentation = args.field.documentation;

  if (documentation) {
    const match = documentation.match(/@dto\(([^)]+)\)/);

    if (match) {
      const content = match[1];
      const hidden = /hidden:\s*true/.test(content);
      const nested = /nested:\s*true/.test(content);

      if (hidden || nested) {
        return { hidden, nested };
      }
    }
  }

  return undefined;
};
