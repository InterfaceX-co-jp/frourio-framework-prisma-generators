import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../../../utils/types";
import type { DtoFieldAnnotation } from "./types";

export const parseFieldDtoAnnotation = (args: {
  field: ReadonlyDeep<PrismaDMMF.Field>;
}): DtoFieldAnnotation | undefined => {
  const documentation = args.field.documentation;

  if (documentation) {
    const hidden = /@dto\(hidden:\s*true\)/.test(documentation);

    if (hidden) {
      return { hidden: true };
    }
  }

  return undefined;
};
