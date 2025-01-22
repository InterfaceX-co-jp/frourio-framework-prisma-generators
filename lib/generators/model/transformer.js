"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const writeFileSafely_1 = require("../utils/writeFileSafely");
const changeCase = __importStar(require("change-case-all"));
const parseFieldDocumentation_1 = require("./lib/json/parseFieldDocumentation");
class Transformer {
    constructor(args) {
        this._models = [];
        this._outputPath = "./prisma/__generated__/models";
        this._additionalTypePath = "../../@additionalType/index.ts";
        this._models = args.models;
    }
    setOutputPath(args) {
        this._outputPath = args.path;
    }
    setAdditionalTypePath(args) {
        this._additionalTypePath = args.path;
    }
    generatePrismaRuntimeTypeImports(args) {
        return args.model.fields.find((field) => field.type === "Json")
            ? `import type { JsonValue } from "@prisma/client/runtime/library"`
            : "";
    }
    generateAdditionalTypeImport(args) {
        if (!args.model.fields.find((field) => field.type === "Json")) {
            return "";
        }
        const imports = args.model.fields.map((field) => {
            var _a;
            if (field.type === "Json" && field.documentation) {
                const parsed = (0, parseFieldDocumentation_1.parseFieldDocumentation)({
                    field,
                });
                if (parsed) {
                    return (_a = parsed.type) === null || _a === void 0 ? void 0 : _a.jsonType;
                }
            }
        });
        return `import { 
              ${[...new Set(imports)].filter((i) => i).join(", ")}
            } from '${this._additionalTypePath}';`;
    }
    get jsonFields() {
        return this._models
            .map((model) => {
            return {
                [model.name]: model.fields.filter((field) => field.type === "Json"),
            };
        })
            .flat();
    }
    generatePrismaModelImportStatement(args) {
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
    renderKeyValueFieldStringFromDMMFField(args) {
        var _a, _b;
        const requiredOrNullKey = args.field.isRequired ? "" : "?";
        const requiredOrNullValue = args.field.isRequired ? "" : "| null";
        const renderKey = `${args.field.name}${requiredOrNullKey}`;
        if (args.field.relationName) {
            return args.field.isList
                ? `${renderKey}: ${changeCase.pascalCase(args.field.type)}WithIncludes[]`
                : `${renderKey}: ${args.overrideValue ? args.overrideValue : this.mapPrismaValueType({ field: args.field })}${requiredOrNullValue}`;
        }
        if (args.field.type === "Json" && args.field.documentation) {
            const parsed = (0, parseFieldDocumentation_1.parseFieldDocumentation)({
                field: args.field,
            });
            if (parsed) {
                return args.field.isList
                    ? `${renderKey}: ${(_a = parsed.type) === null || _a === void 0 ? void 0 : _a.jsonType}[]`
                    : `${renderKey}: ${args.overrideValue ? args.overrideValue : (_b = parsed.type) === null || _b === void 0 ? void 0 : _b.jsonType}${requiredOrNullValue}`;
            }
        }
        return `${renderKey}: ${args.overrideValue ? args.overrideValue : this.mapPrismaValueType({ field: args.field })}${requiredOrNullValue}`;
    }
    generateModelDtoType(args) {
        let keyValueList = args.model.fields.map((field) => {
            if (field.relationName) {
                return this.renderKeyValueFieldStringFromDMMFField({
                    field,
                });
            }
            return this.renderKeyValueFieldStringFromDMMFField({
                field,
                overrideValue: field.type === "DateTime"
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
    generateModelGetterFields(args) {
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
    generateModelFields(args) {
        let keyValueList = args.model.fields.map((field) => {
            return `private readonly _${this.renderKeyValueFieldStringFromDMMFField({ field })};`;
        });
        const fields = this.removeRelationFromFieldsId({
            model: args.model,
            mutatingList: keyValueList,
        });
        return fields.join("\n  ");
    }
    generateModelConstructorType(args) {
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
    generateModelConstructor(args) {
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
    generateStaticFromPrismaValueType(args) {
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
    generateStaticFromPrismaValue(args) {
        let keyValueList = args.model.fields.map((field) => {
            var _a;
            if (field.relationName) {
                return `${changeCase.camelCase(field.name)}: args.${changeCase.camelCase(field.name)}`;
            }
            if (field.type === "Decimal") {
                return `${changeCase.camelCase(field.name)}: args.self.${field.name}.toNumber()`;
            }
            if (field.type === "Json" && field.documentation) {
                const parsed = (0, parseFieldDocumentation_1.parseFieldDocumentation)({
                    field,
                });
                if (parsed) {
                    return `${changeCase.camelCase(field.name)}: args.self.${field.name} as ${(_a = parsed.type) === null || _a === void 0 ? void 0 : _a.jsonType}`;
                }
            }
            return `${changeCase.camelCase(field.name)}: args.self.${field.name}`;
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
    removeRelationFromFieldsId(args) {
        var _a;
        let mutatingList = [...args.mutatingList];
        for (const field of args.model.fields) {
            if (field.relationName) {
                (_a = field.relationFromFields) === null || _a === void 0 ? void 0 : _a.forEach((relationField) => {
                    mutatingList = mutatingList.filter((keyValue) => {
                        return !keyValue.includes(relationField);
                    });
                });
            }
        }
        return mutatingList;
    }
    generateToDtoMethod(args) {
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
        return `toDto() {
            return {
                ${fields.join(",\n")}
            };
        }`;
    }
    _changeModelFieldsToCamelCase(args) {
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
    generateWithAndWithoutIncludePrismaType(args) {
        // const fieldGenerationFrequency: Record<string, number> = {};
        return args.model.fields
            .filter((field) => field.relationName)
            .map((field) => {
            const selectingModel = this._models.find((model) => model.name === field.type);
            // if (fieldGenerationFrequency[field.type] >= 1) {
            //   return;
            // }
            const result = `
          const include${changeCase.pascalCase(field.type)} = {
            include: {
              ${selectingModel === null || selectingModel === void 0 ? void 0 : selectingModel.fields.filter((el) => el.relationName).map((field) => {
                return `${field.name}: true`;
            })} 
            }
          }

          type ${changeCase.pascalCase(field.type)}WithIncludes = PartialBy<
            Prisma.${field.type}GetPayload<
              typeof include${changeCase.pascalCase(field.type)}
            >,
            keyof typeof include${changeCase.pascalCase(field.type)}["include"]
          >;
        `;
            // fieldGenerationFrequency[field.type] = 1;
            return result;
        })
            .join("\n");
    }
    async transform() {
        for (const model of this._models) {
            const camelCasedModel = this._changeModelFieldsToCamelCase({ model });
            (0, writeFileSafely_1.writeFileSafely)(`${this._outputPath}/${model.name}.model.ts`, `
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

          export type ${model.name}ModelFromPrismaValueArgs = ${this.generateStaticFromPrismaValueType({ model: camelCasedModel })}

          export class ${model.name}Model {
              ${this.generateModelFields({ model: camelCasedModel })}

              ${this.generateModelConstructor({ model: camelCasedModel })}

              ${this.generateStaticFromPrismaValue({ model })}

              ${this.generateToDtoMethod({ model: camelCasedModel })}

              ${this.generateModelGetterFields({ model: camelCasedModel })}
          }
        `)
                .then(() => {
                console.log(`[Frourio Framework]Model Generated: ${model.name}.model.ts`);
            })
                .catch((e) => {
                console.error(e);
            });
        }
    }
    mapPrismaValueType(args) {
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
exports.default = Transformer;
//# sourceMappingURL=transformer.js.map