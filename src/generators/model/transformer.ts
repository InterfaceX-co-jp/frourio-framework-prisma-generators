import type {
  DMMF as PrismaDMMF,
  ReadonlyDeep,
} from "@prisma/generator-helper";
import { writeFileSafely } from "../utils/writeFileSafely";
import * as changeCase from "change-case-all";
import { parseFieldDocumentation } from "./lib/json/parseFieldDocumentation";

export default class Transformer {
  private readonly _models: ReadonlyDeep<PrismaDMMF.Model[]> = [];
  private _outputPath: string = "./prisma/__generated__/models";
  private _additionalTypePath: string = "../../@additionalType/index.ts";

  constructor(args: { models: ReadonlyDeep<PrismaDMMF.Model[]> }) {
    this._models = args.models;
  }

  setOutputPath(args: { path: string }) {
    this._outputPath = args.path;
  }

  setAdditionalTypePath(args: { path: string }) {
    this._additionalTypePath = args.path;
  }

  private generatePrismaRuntimeTypeImports(args: { model: PrismaDMMF.Model }) {
    return args.model.fields.find((field) => field.type === "Json")
      ? `import type { JsonValue } from "@prisma/client/runtime/library"`
      : "";
  }

  private generateAdditionalTypeImport(args: { model: PrismaDMMF.Model }) {
    if (!args.model.fields.find((field) => field.type === "Json")) {
      return "";
    }

    const imports = args.model.fields.map((field) => {
      if (field.type === "Json" && field.documentation) {
        const jsonType = parseFieldDocumentation({
          field,
        });

        if (jsonType) {
          return jsonType.type;
        }
      }
    });

    return `import { 
              ${[...new Set(imports)].filter((i) => i).join(", ")}
            } from '${this._additionalTypePath}';`;
  }

  private get jsonFields() {
    return this._models
      .map((model) => {
        return {
          [model.name]: model.fields.filter((field) => field.type === "Json"),
        };
      })
      .flat();
  }

  private generatePrismaModelImportStatement(args: {
    model: PrismaDMMF.Model;
  }) {
    const imports = [
      `${args.model.name} as Prisma${args.model.name}`,
      ...args.model.fields.map((field) => {
        if (field.relationName || field.kind === "enum") {
          return `${field.type} as Prisma${field.type}`;
        }
      }),
    ];

    return `import { 
              ${[...new Set(imports)].filter((i) => i).join(", ")}
            } from '@prisma/client';`;
  }

  /**
   * renders a key-value paired field string
   * (e.x.) `name?: string | null`
   */
  private renderKeyValueFieldStringFromDMMFField(args: {
    field: PrismaDMMF.Field;
    overrideValue?: string;
  }) {
    const requiredOrNullKey = args.field.isRequired ? "" : "?";
    const requiredOrNullValue = args.field.isRequired ? "" : "| null";

    const renderKey = `${args.field.name}${requiredOrNullKey}`;

    if (args.field.relationName) {
      return args.field.isList
        ? `${renderKey}: Prisma${args.field.type}[]`
        : `${renderKey}: ${args.overrideValue ? args.overrideValue : this.mapPrismaValueType({ field: args.field })}${requiredOrNullValue}`;
    }

    if (args.field.type === "Json" && args.field.documentation) {
      const jsonType = parseFieldDocumentation({
        field: args.field,
      });

      if (jsonType) {
        return args.field.isList
          ? `${renderKey}: ${jsonType.type}[]`
          : `${renderKey}: ${args.overrideValue ? args.overrideValue : jsonType?.type}${requiredOrNullValue}`;
      }
    }

    return `${renderKey}: ${args.overrideValue ? args.overrideValue : this.mapPrismaValueType({ field: args.field })}${requiredOrNullValue}`;
  }

  private generateModelDtoInterface(args: { model: PrismaDMMF.Model }) {
    return `
        export interface ${args.model.name}ModelDto {
            ${args.model.fields
              .map((field) => {
                if (field.relationName) {
                  return this.renderKeyValueFieldStringFromDMMFField({
                    field,
                    overrideValue: "Prisma" + field.type,
                  });
                }

                return this.renderKeyValueFieldStringFromDMMFField({
                  field,
                  overrideValue:
                    field.type === "DateTime"
                      ? `string${field.isList ? "[]" : ""}`
                      : undefined, // DTO needs to be string for Date
                });
              })
              .join("\n  ")}
        }
    `;
  }

  private generateModelGetterFields(args: { model: PrismaDMMF.Model }) {
    return args.model.fields
      .map((field) => {
        return `get ${field.name}() {
            return this._${field.name};
        }`;
      })
      .join("\n\n  ");
  }

  private generateModelFields(args: { model: PrismaDMMF.Model }) {
    return args.model.fields
      .map((field) => {
        return `private readonly _${this.renderKeyValueFieldStringFromDMMFField({ field })};`;
      })
      .join("\n  ");
  }

  private generateModelConstructorType(args: { model: PrismaDMMF.Model }) {
    return `{
              ${args.model.fields
                .map((field) => {
                  return this.renderKeyValueFieldStringFromDMMFField({ field });
                })
                .join(";\n")}
            }`;
  }

  private generateModelConstructor(args: { model: PrismaDMMF.Model }) {
    return `constructor(args: ${args.model.name}ModelConstructorArgs) {
            ${args.model.fields
              .map((field) => {
                return `this._${field.name} = args.${field.name};`;
              })
              .join("\n  ")}
        }`;
  }

  private generateStaticFromPrismaValueType(args: { model: PrismaDMMF.Model }) {
    return `{
              self: Prisma${args.model.name},
              ${args.model.fields
                .filter((field) => field.relationName)
                .map((field) => {
                  return `${changeCase.camelCase(field.name)}${field.isRequired ? "" : "?"}: Prisma${field.type}${field.isList ? "[]" : ""}`;
                })
                .join(",\n")}
            }`;
  }

  private generateStaticFromPrismaValue(args: { model: PrismaDMMF.Model }) {
    return `static fromPrismaValue(args: ${args.model.name}ModelFromPrismaValueArgs) {
                return new ${args.model.name}Model({
                    ${args.model.fields
                      .map((field) => {
                        if (field.relationName) {
                          return `${changeCase.camelCase(field.name)}: args.${changeCase.camelCase(field.name)}`;
                        }

                        if (field.type === "Decimal") {
                          return `${changeCase.camelCase(field.name)}: args.self.${field.name}.toNumber()`;
                        }

                        return `${changeCase.camelCase(field.name)}: args.self.${field.name}`;
                      })
                      .join(",\n")}
                });
            }`;
  }

  private generateToDtoMethod(args: { model: PrismaDMMF.Model }) {
    return `toDto() {
            return {
                ${args.model.fields
                  .map((field) => {
                    if (field.type === "DateTime") {
                      return field.isList
                        ? `${field.name}: this._${field.name}.map((el => el.toISOString()))` // convert Date to string
                        : `${field.name}: this._${field.name}.toISOString()`; // convert Date to string
                    }

                    return `${field.name}: this._${field.name}`;
                  })
                  .join(",\n")}
            };
        }`;
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
        `${this._outputPath}/${model.name}.model.ts`,
        `
          ${this.generatePrismaRuntimeTypeImports({ model: camelCasedModel })}
          ${this.generatePrismaModelImportStatement({ model: camelCasedModel })}
          ${this.generateAdditionalTypeImport({ model: camelCasedModel })}

          ${this.generateModelDtoInterface({ model: camelCasedModel })}

          export type ${model.name}ModelConstructorArgs = ${this.generateModelConstructorType({ model: camelCasedModel })}

          export type ${model.name}ModelFromPrismaValueArgs = ${this.generateStaticFromPrismaValueType({ model: camelCasedModel })}

          export class ${model.name}Model {
              ${this.generateModelFields({ model: camelCasedModel })}

              ${this.generateModelConstructor({ model: camelCasedModel })}

              ${this.generateStaticFromPrismaValue({ model })}

              ${this.generateToDtoMethod({ model: camelCasedModel })}

              ${this.generateModelGetterFields({ model: camelCasedModel })}
          }
        `,
      )
        .then(() => {
          console.log(
            `[Frourio Framework]Model Generated: ${model.name}.model.ts`,
          );
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  private mapPrismaValueType(args: { field: PrismaDMMF.Field }) {
    const mappedType = () => {
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
          return "JsonValue";
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
    };

    return args.field.isList ? `${mappedType()}[]` : mappedType();
  }

  get hasJsonFields() {
    return this.jsonFields.length > 0;
  }
}
