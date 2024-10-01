import type {
  DMMF as PrismaDMMF,
  ReadonlyDeep,
} from "@prisma/generator-helper";
import { writeFileSafely } from "../utils/writeFileSafely";
import * as changeCase from "change-case-all";

export default class Transformer {
  private readonly _models: ReadonlyDeep<PrismaDMMF.Model[]> = [];
  private _outputPath: string = "./prisma/__generated__/models";

  constructor(args: { models: ReadonlyDeep<PrismaDMMF.Model[]> }) {
    this._models = args.models;
  }

  setOutputPath(args: { path: string }) {
    this._outputPath = args.path;
  }

  private generateImportStatement(args: { model: PrismaDMMF.Model }) {
    const imports = [
      `import { 
        PrismaClient,
        Prisma${args.model.name}CreateInput, 
        Prisma${args.model.name}UpdateInput, 
        Prisma${args.model.name}WhereUniqueInput 
      } from "@prisma/client";`,
      `import  { ${args.model.name}Model } from "../model/${args.model.name}.model";`,
    ];

    return `import { 
              ${[...new Set(imports)].filter((i) => i).join(", ")}
            } from '@prisma/client';`;
  }

  private generateRepositoryInterface(args: { model: PrismaDMMF.Model }) {
    return `
        export interface IBase${args.model.name}Repository {
            create(args: { data: Prisma${args.model.name}CreateInput }): Promise<${args.model.name}Model>;
            update(data: Prisma${args.model.name}UpdateInput): Promise<${args.model.name}Model>;
            delete(where: Prisma${args.model.name}WhereUniqueInput): Promise<${args.model.name}Model>;
            findMany(): Promise<Prisma${args.model.name}[]>;
            findOne(where: Prisma${args.model.name}WhereUniqueInput): Promise<${args.model.name}Model>;
        }
    `;
  }

  private _changeModelFieldsToCamelCase(args: { model: PrismaDMMF.Model }) {
    return {
      ...args.model,
      fields: args.model.fields.map((field) => {
        return {
          ...field,
          name: changeCase.camelCase(field.name),
        };
      }),
    };
  }

  async transform() {
    for (const model of this._models) {
      const camelCasedModel = this._changeModelFieldsToCamelCase({ model });

      writeFileSafely(
        `${this._outputPath}/${model.name}.repository.ts`,
        `
          ${this.generateImportStatement({ model: camelCasedModel })}
        `,
      );
    }
  }

  private mapPrismaValueType(args: { field: PrismaDMMF.Field }) {
    switch (args.field.type) {
      case "String":
        return "string";
      case "Int":
        return "number";
      case "Boolean":
        return "boolean";
      case "DateTime":
        return "Date";
      case "Json":
        return "Record<string, unknown>";
      case "Float":
        return "number";
      case "Enum":
        return "string";
      case "Decimal":
        return "number";
      case "BigInt":
        return "bigint";
      case "Bytes":
        return "Buffer";
      case args.field.type:
        return `Prisma${args.field.type}`;
      default:
        return "unknown";
    }
  }
}
