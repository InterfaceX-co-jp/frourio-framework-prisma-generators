import type { DMMF as PrismaDMMF, ReadonlyDeep } from "@prisma/generator-helper";
export declare const parseFieldDocumentation: (args: {
    field: ReadonlyDeep<PrismaDMMF.Field>;
}) => {
    type: {
        jsonType: string | undefined;
        hasJsonType: boolean;
    };
} | undefined;
