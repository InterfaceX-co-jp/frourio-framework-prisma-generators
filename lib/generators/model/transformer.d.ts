import type { DMMF as PrismaDMMF, ReadonlyDeep } from "@prisma/generator-helper";
export default class Transformer {
    private readonly _models;
    private _outputPath;
    private _additionalTypePath;
    constructor(args: {
        models: ReadonlyDeep<PrismaDMMF.Model[]>;
    });
    setOutputPath(args: {
        path: string;
    }): void;
    setAdditionalTypePath(args: {
        path: string;
    }): void;
    private generatePrismaRuntimeTypeImports;
    private generateAdditionalTypeImport;
    private get jsonFields();
    private generatePrismaModelImportStatement;
    /**
     * renders a key-value paired field string
     * (e.x.) `name?: string | null`
     */
    private renderKeyValueFieldStringFromDMMFField;
    private generateModelDtoType;
    private generateModelGetterFields;
    private generateModelFields;
    private generateModelConstructorType;
    private generateModelConstructor;
    private generateStaticFromPrismaValueType;
    private generateStaticFromPrismaValue;
    private removeRelationFromFieldsId;
    private generateToDtoMethod;
    private _changeModelFieldsToCamelCase;
    generateWithAndWithoutIncludePrismaType(args: {
        model: PrismaDMMF.Model;
        pascalCasedModel: {
            name: string;
        };
    }): string;
    transform(): Promise<void>;
    private mapPrismaValueType;
    get hasJsonFields(): boolean;
}
