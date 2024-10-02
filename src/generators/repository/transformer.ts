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
        type Prisma
      } from "@prisma/client";`,
      `import  { ${args.model.name}Model } from "../model/${args.model.name}.model";`,
    ];

    return imports.join("\n");
  }

  private generateRepositoryInterface(args: { model: PrismaDMMF.Model }) {
    const hasIdField = args.model.fields.find((el) => el.isId);

    const interfaceMethodsRequiresId = [
      `findOneById(args: { id: ${args.model.fields.find((el) => el.isId)} }): Promise<${args.model.name}Model>;`,
    ];

    const essentialIterfaceMethods = [
      `create(args: { data: Prisma.${args.model.name}CreateInput }): Promise<${args.model.name}Model>;`,
      `update(data: Prisma.${args.model.name}UpdateInput): Promise<${args.model.name}Model>;`,
      `delete(where: Prisma.${args.model.name}WhereUniqueInput): Promise<void>;`,
    ];

    const interfaceMethods = [
      ...(hasIdField ? interfaceMethodsRequiresId : []),
      ...essentialIterfaceMethods,
    ];

    return `
        export interface IBase${args.model.name}Repository {
            ${interfaceMethods.join("\n")}
        }
    `;
  }

  private generateRepositoryMethods(args: { model: PrismaDMMF.Model }) {
    const hasIdField = args.model.fields.find((el) => el.isId);

    const repositoryMethodsRequiresId = [
      `
      async findOneById(args: { id: ${args.model.fields.find((el) => el.isId)} }): Promise<${args.model.name}Model> {
        const data = this._prisma.${args.model.name}.findUnique({
          where: {
            id: args.id,
          },
        });

        return ${args.model.name}Model.fromPrismaValue({ self: data });
      }
    `,
    ];

    const essentialRepositoryMethods = [``];

    const repositoryMethods = [
      ...(hasIdField ? repositoryMethodsRequiresId : []),
      ...essentialRepositoryMethods,
    ];

    return repositoryMethods.join("\n");
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
        `${this._outputPath}/Base${model.name}.repository.ts`,
        `
          ${this.generateImportStatement({ model: camelCasedModel })}


          export class Base${model.name}Repository implements IBase${model.name}Repository {
              private readonly _prisma: PrismaClient;

              constructor({ prisma }: { prisma: PrismaClient }) {
                  this._prisma = prisma;
              }

          }
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
