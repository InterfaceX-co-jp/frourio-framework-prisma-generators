import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../utils/types";
import { writeFileSafely } from "../utils/writeFileSafely";
import * as changeCase from "change-case-all";
import { parseFieldDocumentation } from "./lib/json/parseFieldDocumentation";
import { parseFieldDtoAnnotation } from "./lib/dto/parseFieldDtoAnnotation";
import { parseModelDtoProfiles } from "./lib/dto/parseModelDtoProfiles";
import type { DtoProfile } from "./lib/dto/types";

export default class Transformer {
  private readonly _models: ReadonlyDeep<PrismaDMMF.Model[]> = [];
  private _outputPath: string = "./prisma/__generated__/models";
  private _additionalTypePath: string = "../../@additionalType/index";

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
    // JsonValue is now accessed via Prisma.JsonValue in Prisma Client v7+
    return "";
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

    const filteredImports = [...new Set(imports)].filter((i) => i);
    
    if (filteredImports.length === 0) {
      return "";
    }

    return `import {
              ${filteredImports.join(", ")}
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

  private getHiddenFieldNames(args: { model: PrismaDMMF.Model }): Set<string> {
    const hidden = new Set<string>();
    for (const field of args.model.fields) {
      const annotation = parseFieldDtoAnnotation({ field });
      if (annotation?.hidden) {
        hidden.add(field.name);
      }
    }
    return hidden;
  }

  private getNestedFieldNames(args: { model: PrismaDMMF.Model }): Set<string> {
    const nested = new Set<string>();
    for (const field of args.model.fields) {
      if (field.relationName) {
        const annotation = parseFieldDtoAnnotation({ field });
        if (annotation?.nested) {
          nested.add(field.name);
        }
      }
    }
    return nested;
  }

  private getProfileFields(args: {
    model: PrismaDMMF.Model;
    profile: DtoProfile;
  }): PrismaDMMF.Field[] {
    const fieldNames = new Set(args.model.fields.map((f) => f.name));

    if (args.profile.pick) {
      const validPick = args.profile.pick.filter((name) => {
        if (!fieldNames.has(name)) {
          console.warn(
            `[Frourio Framework] @dto.profile "${args.profile.name}": field "${name}" does not exist on model. Skipping.`,
          );
          return false;
        }
        return true;
      });
      return args.model.fields.filter((f) => validPick.includes(f.name));
    }

    if (args.profile.omit) {
      const omitSet = new Set(args.profile.omit);
      for (const name of omitSet) {
        if (!fieldNames.has(name)) {
          console.warn(
            `[Frourio Framework] @dto.profile "${args.profile.name}": field "${name}" does not exist on model. Skipping.`,
          );
        }
      }
      return args.model.fields.filter((f) => !omitSet.has(f.name));
    }

    return [...args.model.fields];
  }

  private renderDtoFieldKeyValue(args: {
    field: PrismaDMMF.Field;
    nestedFields?: Set<string>;
  }) {
    if (args.field.relationName) {
      if (args.nestedFields?.has(args.field.name)) {
        const dtoType = `${changeCase.pascalCase(args.field.type)}ModelDto`;
        const requiredOrNullKey = args.field.isRequired ? "" : "?";
        const requiredOrNullValue = args.field.isRequired ? "" : " | null";
        return args.field.isList
          ? `${args.field.name}${requiredOrNullKey}: ${dtoType}[]`
          : `${args.field.name}${requiredOrNullKey}: ${dtoType}${requiredOrNullValue}`;
      }
      return this.renderKeyValueFieldStringFromDMMFField({
        field: args.field,
      });
    }

    return this.renderKeyValueFieldStringFromDMMFField({
      field: args.field,
      overrideValue:
        args.field.type === "DateTime"
          ? `string${args.field.isList ? "[]" : ""}`
          : undefined,
    });
  }

  private renderDtoFieldValue(args: {
    field: PrismaDMMF.Field;
    nestedFields?: Set<string>;
  }) {
    const accessor = `this._${args.field.name}`;

    if (args.field.relationName && args.nestedFields?.has(args.field.name)) {
      const modelName = `${changeCase.pascalCase(args.field.type)}Model`;
      const conversion = `${modelName}.builder().fromPrisma(el).build().toDto()`;

      if (args.field.isList) {
        return `${args.field.name}: ${accessor}.map((el) => ${conversion})`;
      }
      if (args.field.isRequired) {
        const singleConversion = `${modelName}.builder().fromPrisma(${accessor}).build().toDto()`;
        return `${args.field.name}: ${singleConversion}`;
      }
      const singleConversion = `${modelName}.builder().fromPrisma(${accessor}!).build().toDto()`;
      return `${args.field.name}: ${accessor} ? ${singleConversion} : null`;
    }

    if (args.field.type === "DateTime") {
      if (args.field.isList) {
        return `${args.field.name}: ${this.wrapNullable({ field: args.field, accessor, conversion: ".map((el) => el.toISOString())" })}`;
      }
      return `${args.field.name}: ${this.wrapNullable({ field: args.field, accessor, conversion: ".toISOString()" })}`;
    }

    return `${args.field.name}: ${accessor}`;
  }

  private generateModelDtoType(args: { model: PrismaDMMF.Model }) {
    const hiddenFields = this.getHiddenFieldNames({ model: args.model });
    const nestedFields = this.getNestedFieldNames({ model: args.model });

    let keyValueList = args.model.fields
      .filter((field) => !hiddenFields.has(field.name))
      .map((field) => this.renderDtoFieldKeyValue({ field, nestedFields }));

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
    let keyValueList = args.model.fields
      .filter((field) => field.relationName)
      .map((field) => {
        return `${changeCase.camelCase(field.name)}${field.isRequired ? "" : "?"}: ${changeCase.pascalCase(field.type)}WithIncludes${field.isList ? "[]" : ""}`;
      });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `{
              self: Prisma${args.model.name},
              ${fields.join(",\n")}
            }`;
  }

  /**
   * Wraps an expression with optional chaining and null fallback when the field is nullable.
   * - required:  `accessor.method()`
   * - optional:  `accessor?.method() ?? null`
   */
  private wrapNullable(args: {
    field: PrismaDMMF.Field;
    accessor: string;
    conversion: string;
  }) {
    if (args.field.isRequired) {
      return `${args.accessor}${args.conversion}`;
    }
    return `${args.accessor}?${args.conversion} ?? null`;
  }

  private generateStaticFromPrismaValue(args: { model: PrismaDMMF.Model }) {
    let keyValueList = args.model.fields.map((field) => {
      const camelName = changeCase.camelCase(field.name);
      const accessor = `args.self.${field.name}`;

      if (field.relationName) {
        return `${camelName}: args.${camelName}`;
      }

      if (field.type === "Decimal") {
        return `${camelName}: ${this.wrapNullable({ field, accessor, conversion: ".toNumber()" })}`;
      }

      if (field.type === "Json" && field.documentation) {
        const parsed = parseFieldDocumentation({ field });
        if (parsed) {
          return `${camelName}: ${accessor} as unknown as ${parsed.type?.jsonType}`;
        }
      }

      return `${camelName}: ${accessor}`;
    });

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `static fromPrismaValue(args: ${args.model.name}ModelFromPrismaValueArgs) {
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
    const hiddenFields = this.getHiddenFieldNames({ model: args.model });
    const nestedFields = this.getNestedFieldNames({ model: args.model });

    const keyValueList = args.model.fields
      .filter((field) => !hiddenFields.has(field.name))
      .map((field) => this.renderDtoFieldValue({ field, nestedFields }));

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

  private generateProfileDtoType(args: {
    model: PrismaDMMF.Model;
    profile: DtoProfile;
  }) {
    const nestedFields = this.getNestedFieldNames({ model: args.model });
    const profileFields = this.getProfileFields({
      model: args.model,
      profile: args.profile,
    });

    let keyValueList = profileFields.map((field) =>
      this.renderDtoFieldKeyValue({ field, nestedFields }),
    );

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    return `
        export type ${args.model.name}${args.profile.name}Dto = {
            ${fields.join("\n  ")}
        }
    `;
  }

  private generateProfileToDtoMethod(args: {
    model: PrismaDMMF.Model;
    profile: DtoProfile;
  }) {
    const nestedFields = this.getNestedFieldNames({ model: args.model });
    const profileFields = this.getProfileFields({
      model: args.model,
      profile: args.profile,
    });

    const keyValueList = profileFields.map((field) =>
      this.renderDtoFieldValue({ field, nestedFields }),
    );

    const fields = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: keyValueList,
    });

    const methodName = `to${args.profile.name}Dto`;
    const typeName = `${args.model.name}${args.profile.name}Dto`;

    return `${methodName}(): ${typeName} {
            return {
                ${fields.join(",\n")}
            };
        }`;
  }

  // =========================================
  // Builder generation methods
  // =========================================

  private generateBuilderFromPrismaMethod(args: {
    model: PrismaDMMF.Model;
    originalModelName: string;
  }) {
    const scalarAssignments = args.model.fields
      .filter((field) => !field.relationName)
      .map((field) => {
        const accessor = `value.${field.name}`;

        if (field.type === "Decimal") {
          return `this._args.${field.name} = ${this.wrapNullable({ field, accessor, conversion: ".toNumber()" })};`;
        }

        if (field.type === "Json" && field.documentation) {
          const parsed = parseFieldDocumentation({ field });
          if (parsed) {
            return `this._args.${field.name} = ${accessor} as unknown as ${parsed.type?.jsonType};`;
          }
        }

        return `this._args.${field.name} = ${accessor};`;
      });

    const filteredAssignments = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: scalarAssignments,
    });

    return `fromPrisma(value: Prisma${args.originalModelName}): this {
            ${filteredAssignments.join("\n            ")}
            return this;
        }`;
  }

  private generateBuilderScalarSetters(args: { model: PrismaDMMF.Model }) {
    const setters = args.model.fields
      .filter((field) => !field.relationName)
      .map((field) => {
        const tsType = this.mapPrismaValueType({ field });
        const paramType = field.isRequired ? tsType : `${tsType} | null`;

        return `${field.name}(value: ${paramType}): this {
            this._args.${field.name} = value;
            return this;
        }`;
      });

    const filtered = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: setters,
    });

    return filtered.join("\n\n        ");
  }

  private generateBuilderRelationSetters(args: { model: PrismaDMMF.Model }) {
    const setters = args.model.fields
      .filter((field) => field.relationName)
      .map((field) => {
        const typeName = `${changeCase.pascalCase(field.type)}WithIncludes`;
        const fullType = field.isList
          ? `${typeName}[]`
          : field.isRequired
            ? typeName
            : `${typeName} | null`;

        return `${changeCase.camelCase(field.name)}(value: ${fullType}): this {
            this._args.${changeCase.camelCase(field.name)} = value;
            return this;
        }`;
      });

    const filtered = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: setters,
    });

    return filtered.join("\n\n        ");
  }

  private generateBuilderBuildArgsMethod(args: { model: PrismaDMMF.Model }) {
    const validations: string[] = [];
    const assignments: string[] = [];

    const processedFields = args.model.fields.map((field) => {
      if (field.relationName) {
        const camelName = changeCase.camelCase(field.name);
        if (field.isList) {
          // List relation → default []
          return { assignment: `${camelName}: this._args.${camelName} ?? []` };
        } else if (field.isRequired) {
          // Required single relation → throw if missing
          return {
            validation: `if (this._args.${camelName} === undefined) throw new Error('${args.model.name}ModelBuilder: "${camelName}" is required');`,
            assignment: `${camelName}: this._args.${camelName}!`,
          };
        } else {
          // Optional single relation → passthrough
          return { assignment: `${camelName}: this._args.${camelName}` };
        }
      }

      // Scalar fields
      if (field.isRequired) {
        return {
          validation: `if (this._args.${field.name} === undefined) throw new Error('${args.model.name}ModelBuilder: "${field.name}" is required');`,
          assignment: `${field.name}: this._args.${field.name}`,
        };
      } else {
        return { assignment: `${field.name}: this._args.${field.name} ?? null` };
      }
    });

    // Filter out FK fields
    const allFieldStrings = processedFields.map((pf) => pf.assignment);
    const filteredAssignments = this.removeRelationFromFieldsId({
      model: args.model,
      mutatingList: allFieldStrings,
    });
    const filteredAssignmentSet = new Set(filteredAssignments);

    for (const pf of processedFields) {
      if (filteredAssignmentSet.has(pf.assignment)) {
        if (pf.validation) {
          validations.push(pf.validation);
        }
        assignments.push(pf.assignment);
      }
    }

    return `protected buildArgs(): ${args.model.name}ModelConstructorArgs {
            ${validations.join("\n            ")}
            return {
                ${assignments.join(",\n                ")}
            };
        }`;
  }

  private generateBuilderClass(args: {
    model: PrismaDMMF.Model;
    originalModelName: string;
  }) {
    return `export class ${args.model.name}ModelBuilder {
        protected _args: Partial<${args.model.name}ModelConstructorArgs> = {};

        ${this.generateBuilderFromPrismaMethod({ model: args.model, originalModelName: args.originalModelName })}

        ${this.generateBuilderScalarSetters({ model: args.model })}

        ${this.generateBuilderRelationSetters({ model: args.model })}

        ${this.generateBuilderBuildArgsMethod({ model: args.model })}

        build(): ${args.model.name}Model {
            return new ${args.model.name}Model(this.buildArgs());
        }
    }`;
  }

  private generateStaticBuilderFactory(args: { model: PrismaDMMF.Model }) {
    return `static builder(): ${args.model.name}ModelBuilder {
            return new ${args.model.name}ModelBuilder();
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

  private generateNestedModelImports(args: { model: PrismaDMMF.Model }): string {
    const nestedFields = this.getNestedFieldNames({ model: args.model });
    if (nestedFields.size === 0) return "";

    const imports = new Set<string>();
    for (const field of args.model.fields) {
      if (field.relationName && nestedFields.has(field.name)) {
        const modelName = changeCase.pascalCase(field.type);
        imports.add(
          `import { ${modelName}Model, type ${modelName}ModelDto } from './${field.type}.model';`,
        );
      }
    }

    return [...imports].join("\n");
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
      const profiles = parseModelDtoProfiles({ model });

      const profileDtoTypes = profiles
        .map((profile) =>
          this.generateProfileDtoType({ model: camelCasedModel, profile }),
        )
        .join("\n");

      const profileToDtoMethods = profiles
        .map((profile) =>
          this.generateProfileToDtoMethod({ model: camelCasedModel, profile }),
        )
        .join("\n\n              ");

      writeFileSafely(
        `${this._outputPath}/${model.name}.model.ts`,
        `
          ${this.generatePrismaRuntimeTypeImports({ model: camelCasedModel })}
          ${this.generatePrismaModelImportStatement({ model: camelCasedModel })}
          ${this.generateAdditionalTypeImport({ model: camelCasedModel })}
          ${this.generateNestedModelImports({ model: camelCasedModel })}

          type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
          type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

          ${this.generateWithAndWithoutIncludePrismaType({
            model: camelCasedModel,
            pascalCasedModel: {
              name: model.name,
            },
          })}

          ${this.generateModelDtoType({ model: camelCasedModel })}

          ${profileDtoTypes}

          export type ${model.name}ModelConstructorArgs = ${this.generateModelConstructorType({ model: camelCasedModel })}

          export type ${model.name}ModelFromPrismaValueArgs = ${this.generateStaticFromPrismaValueType({ model: camelCasedModel })}

          export class ${model.name}Model {
              ${this.generateModelFields({ model: camelCasedModel })}

              ${this.generateModelConstructor({ model: camelCasedModel })}

              ${this.generateStaticFromPrismaValue({ model })}

              ${this.generateStaticBuilderFactory({ model: camelCasedModel })}

              ${this.generateToDtoMethod({ model: camelCasedModel })}

              ${profileToDtoMethods}

              ${this.generateModelGetterFields({ model: camelCasedModel })}
          }

          ${this.generateBuilderClass({ model: camelCasedModel, originalModelName: model.name })}
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
          return "Prisma.JsonValue";
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
