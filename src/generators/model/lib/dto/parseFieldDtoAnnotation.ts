import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../../../utils/types";
import type { DtoFieldAnnotation } from "./types";

export const parseFieldDtoAnnotation = (args: {
  field: ReadonlyDeep<PrismaDMMF.Field>;
}): DtoFieldAnnotation | undefined => {
  const documentation = args.field.documentation;

  if (documentation) {
    // @dto.hide — exclude field from all DTOs
    const hide = /@dto\.hide\b/.test(documentation);

    // @dto.map({ "KEY": "label" }) — static enum→label mapping
    let map: Record<string, string> | undefined;
    const mapMatch = documentation.match(/@dto\.map\((\{[^}]+\})\)/);
    if (mapMatch) {
      try {
        map = JSON.parse(mapMatch[1].replace(/(['"])?([a-zA-Z_]\w*)(['"])?:/g, '"$2":'));
      } catch {
        // ignore parse errors
      }
    }

    if (hide || map) {
      return { hidden: false, hide, map };
    }

    // legacy: @dto(hidden: true, nested: true)
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
