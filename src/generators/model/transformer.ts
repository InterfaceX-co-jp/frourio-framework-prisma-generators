import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../utils/types";
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
        const parsed = parseFieldDocumentation({
          field,
        });

        if (parsed) {
          return parsed.type?.jsonType;
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
              Prisma,
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
        ? `${renderKey}: ${changeCase.pascalCase(args.field.type)}WithIncludes[]`
        : `${renderKey}: ${args.overrideValue ? args.overrideValue : this.mapPrismaValueType({ field: args.field })}${requiredOrNullValue}`;
    }

    if (args.field.type === "Json" && args.field.documentation) {
      const parsed = parseFieldDocumentation({
        field: args.field,
      });

      if (parsed) {
        return args.field.isList
          ? `${renderKey}: ${parsed.type?.jsonType}[]`
          : `${renderKey}: ${args.overrideValue ? args.overrideValue : parsed.type?.jsonType}${requiredOrNullValue}`;
      }
    }

    return `${renderKey}: ${args.overrideValue ? args.overrideValue : this.mapPrismaValueType({ field: args.field })}${requiredOrNullValue}`;
  }

  private generateModelDtoType(args: { model: PrismaDMMF.Model }) {
    let keyValueList = args.model.fields.map((field) => {
      if (field.relationName) {
        return this.renderKeyValueFieldStringFromDMMFField({
          field,
        });
      }

      return this.renderKeyValueFieldStringFromDMMFField({
        field,
        overrideValue:
          field.type === "DateTime"
            ? `string${field.isList ? "[]" : ""}`
            : undefined, // DTO needs to be string for Date
      });
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `
        export type ${args.model.name}ModelDto = {
            ${fields.join("\n  ")}
        }
    `;
  }

  private generateModelGetterFields(args: { model: PrismaDMMF.Model }) {
    let keyValueList = args.model.fields.map((field) => {
      return `get ${field.name}() {
            return this._${field.name};
        }`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return fields.join("\n\n  ");
  }

  private generateModelFields(args: { model: PrismaDMMF.Model }) {
    let keyValueList = args.model.fields.map((field) => {
      return `private readonly _${this.renderKeyValueFieldStringFromDMMFField({ field })};`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return fields.join("\n  ");
  }

  private generateModelConstructorType(args: { model: PrismaDMMF.Model }) {
    let keyValueList = args.model.fields.map((field) => {
      return this.renderKeyValueFieldStringFromDMMFField({ field });
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `{
              ${fields.join(";\n")}
            }`;
  }

  private generateModelConstructor(args: { model: PrismaDMMF.Model }) {
    let keyValueList = args.model.fields.map((field) => {
      return `this._${field.name} = args.${field.name};`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `constructor(args: ${args.model.name}ModelConstructorArgs) {
            ${fields.join("\n  ")}
        }`;
  }

  private generateStaticFromPrismaValueType(args: { model: PrismaDMMF.Model }) {
    const relationFields = args.model.fields.filter((field) => field.relationName);

    const genericDeclarations: string[] = [];
    const genericNames: string[] = [];
    const genericNameByField: Record<string, string> = {};

    relationFields.forEach((field) => {
      const genericName = `T${changeCase.pascalCase(field.name)}`;
      const { defaultType, constraintType } = this.getRelationTypeMeta({
        field,
      });

      genericNameByField[field.name] = genericName;
      genericNames.push(genericName);
      genericDeclarations.push(
        `${genericName} extends ${constraintType} = ${defaultType}`,
      );
    });

    const keyValueList = relationFields.map((field) => {
      const optionalSuffix = field.isRequired ? "" : "?";
      return `${changeCase.camelCase(field.name)}${optionalSuffix}: ${genericNameByField[field.name]}`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return {
      type: `{
              self: Prisma${args.model.name},
              ${fields.join(",\n")}
            }`,
      genericDeclaration:
        genericDeclarations.length > 0
          ? `<${genericDeclarations.join(", ")}>`
          : "",
      genericUsage:
        genericNames.length > 0 ? `<${genericNames.join(", ")}>` : "",
    };
  }

  private generateStaticFromPrismaValue(args: {
    model: PrismaDMMF.Model;
    genericDeclaration?: string;
    genericUsage?: string;
  }) {
    let keyValueList = args.model.fields.map((field) => {
      if (field.relationName) {
        return `${changeCase.camelCase(field.name)}: args.${changeCase.camelCase(field.name)}`;
      }

      if (field.type === "Decimal") {
        return `${changeCase.camelCase(field.name)}: args.self.${field.name}.toNumber()`;
      }

      if (field.type === "Json" && field.documentation) {
        const parsed = parseFieldDocumentation({
          field,
        });

        if (parsed) {
          return `${changeCase.camelCase(field.name)}: args.self.${field.name} as ${parsed.type?.jsonType}`;
        }
      }

      return `${changeCase.camelCase(field.name)}: args.self.${field.name}`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    const genericDeclaration = args.genericDeclaration ?? "";
    const genericUsage = args.genericUsage ?? "";

    return `static fromPrismaValue${genericDeclaration}(args: ${args.model.name}ModelFromPrismaValueArgs${genericUsage}) {
                return new ${args.model.name}Model({
                    ${fields.join(",\n")}
                });
            }`;
  }

  private removeRelationFromFieldsId(args: {
    model: PrismaDMMF.Model;
    mutatingList: string[];
  }) {
    let mutatingList = [...args.mutatingList];

    for (const field of args.model.fields) {
      if (field.relationName) {
        field.relationFromFields?.forEach((relationField) => {
          mutatingList = mutatingList.filter((keyValue) => {
            return !keyValue.includes(changeCase.camelCase(relationField));
          });
        });
      }
    }

    return mutatingList;
  }

  private generateToDtoMethod(args: { model: PrismaDMMF.Model }) {
    const keyValueList = args.model.fields.map((field) => {
      if (field.type === "DateTime") {
        return field.isList
          ? `${field.name}: this._${field.name}?.map((el) => el?.toISOString() ?? null) ?? null` // convert Date to string
          : `${field.name}: this._${field.name}?.toISOString() ?? null`; // convert Date to string
      }

      return `${field.name}: this._${field.name}`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `toDto(): ${args.model.name}ModelDto {
            return {
                ${fields.join(",\n")}
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

  generateWithAndWithoutIncludePrismaType(args: {
    model: PrismaDMMF.Model;
    pascalCasedModel: { name: string };
  }) {
    const fieldGenerationFrequency: Record<string, number> = {};

    return args.model.fields
      .filter((field) => field.relationName)
      .map((field) => {
        const selectingModel = this._models.find(
          (model) => model.name === field.type,
        );

        if (fieldGenerationFrequency[field.type] >= 1) {
          return;
        }
        const result = `
          const include${changeCase.pascalCase(field.type)} = {
            include: {
              ${selectingModel?.fields
                .filter((el) => el.relationName)
                .map((field) => {
                  return `${field.name}: true`;
                })} 
            }
          }

          export type ${changeCase.pascalCase(field.type)}WithIncludes = PartialBy<
            Prisma.${field.type}GetPayload<
              typeof include${changeCase.pascalCase(field.type)}
            >,
            keyof typeof include${changeCase.pascalCase(field.type)}["include"]
          >;
        `;
        fieldGenerationFrequency[field.type] = 1;

        return result;
      })
      .join("\n");
  }

  async transform() {
    for (const model of this._models) {
      const camelCasedModel = this._changeModelFieldsToCamelCase({ model });
      const fromPrismaValueType = this.generateStaticFromPrismaValueType({
        model: camelCasedModel,
      });
      const fromPrismaValueMethod = this.generateStaticFromPrismaValue({
        model,
        genericDeclaration: fromPrismaValueType.genericDeclaration,
        genericUsage: fromPrismaValueType.genericUsage,
      });

      writeFileSafely(
        `${this._outputPath}/${model.name}.model.ts`,
        `
          ${this.generatePrismaRuntimeTypeImports({ model: camelCasedModel })}
          ${this.generatePrismaModelImportStatement({ model: camelCasedModel })}
          ${this.generateAdditionalTypeImport({ model: camelCasedModel })}

          type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
          type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

          ${this.generateWithAndWithoutIncludePrismaType({
            model: camelCasedModel,
            pascalCasedModel: {
              name: model.name,
            },
          })}

          ${this.generateModelDtoType({ model: camelCasedModel })}

          export type ${model.name}ModelConstructorArgs = ${this.generateModelConstructorType({ model: camelCasedModel })}

          export type ${model.name}ModelFromPrismaValueArgs${fromPrismaValueType.genericDeclaration} = ${fromPrismaValueType.type}

          export class ${model.name}Model {
              ${this.generateModelFields({ model: camelCasedModel })}

              ${this.generateModelConstructor({ model: camelCasedModel })}

              ${fromPrismaValueMethod}

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

  private getRelationTypeMeta(args: { field: PrismaDMMF.Field }) {
    const baseType = `${changeCase.pascalCase(args.field.type)}WithIncludes`;

    if (args.field.isList) {
      return {
        defaultType: `${baseType}[]`,
        constraintType: `unknown[]`,
      };
    }

    if (args.field.isRequired) {
      return {
        defaultType: baseType,
        constraintType: `unknown`,
      };
    }

    return {
      defaultType: `${baseType} | null`,
      constraintType: `unknown | null`,
    };
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
          return "ArrayBuffer";
        case args.field.type:
          if (args.field.relationName) {
            return `${args.field.type}WithIncludes`;
          }

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
