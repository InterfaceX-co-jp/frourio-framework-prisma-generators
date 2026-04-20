import type { DMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../utils/types";
import { writeFileSafely } from "../utils/writeFileSafely";
import type { ViewsSpec } from "../../spec/types";
import path from "path";

function scalarToTs(field: ReadonlyDeep<DMMF.Field>): string {
  switch (field.type) {
    case "String":
      return "string";
    case "Int":
    case "Float":
    case "Decimal":
      return "number";
    case "Boolean":
      return "boolean";
    case "DateTime":
      return "Date";
    case "BigInt":
      return "bigint";
    case "Bytes":
      return "Uint8Array";
    case "Json":
      return "unknown";
    default:
      return "string";
  }
}

function resolveDtoType(
  selectVal: unknown,
  dmmfField: ReadonlyDeep<DMMF.Field> | undefined,
  models: ReadonlyDeep<DMMF.Model[]>,
): string {
  if (!dmmfField) return "unknown";

  if (selectVal === true) {
    const base = scalarToTs(dmmfField);
    const nullable = !dmmfField.isRequired ? " | null" : "";
    return dmmfField.isList ? `Array<${base}>${nullable}` : `${base}${nullable}`;
  }

  if (typeof selectVal === "object" && selectVal !== null && "select" in selectVal) {
    const nestedSelect = (selectVal as { select: Record<string, unknown> }).select;
    const relatedModel = models.find((m) => m.name === dmmfField.type);
    if (!relatedModel) return "unknown";
    const shape = buildDtoShape(nestedSelect, relatedModel, models);
    const nullable = !dmmfField.isRequired ? " | null" : "";
    return dmmfField.isList ? `Array<${shape}>${nullable}` : `${shape}${nullable}`;
  }

  return "unknown";
}

function buildDtoShape(
  select: Record<string, unknown>,
  model: ReadonlyDeep<DMMF.Model>,
  models: ReadonlyDeep<DMMF.Model[]>,
): string {
  const fields = Object.entries(select).map(([key, val]) => {
    const dmmfField = model.fields.find((f) => f.name === key);
    const type = resolveDtoType(val, dmmfField, models);
    return `${key}: ${type}`;
  });
  return `{ ${fields.join("; ")} }`;
}

function serializeSelectValue(val: unknown, indent: number): string {
  if (val === true) return "true";
  if (val === false) return "false";
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "number") return String(val);
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    const pad = "  ".repeat(indent);
    const inner = Object.entries(obj)
      .map(([k, v]) => `${pad}  ${k}: ${serializeSelectValue(v, indent + 1)}`)
      .join(",\n");
    return `{\n${inner},\n${pad}}`;
  }
  return JSON.stringify(val);
}

function buildMapperBody(
  select: Record<string, unknown>,
  model: ReadonlyDeep<DMMF.Model>,
  models: ReadonlyDeep<DMMF.Model[]>,
  varName: string,
): string {
  const fields = Object.entries(select).map(([key, val]) => {
    const dmmfField = model.fields.find((f) => f.name === key);
    if (
      typeof val === "object" &&
      val !== null &&
      "select" in val &&
      dmmfField?.isList
    ) {
      const nestedSelect = (val as { select: Record<string, unknown> }).select;
      const relatedModel = models.find((m) => m.name === dmmfField.type);
      if (relatedModel) {
        const innerBody = buildMapperBody(
          nestedSelect,
          relatedModel,
          models,
          "item",
        );
        return `${key}: ${varName}.${key}.map((item) => (${innerBody}))`;
      }
    }
    return `${key}: ${varName}.${key}`;
  });
  return `{ ${fields.join(", ")} }`;
}

export class ViewsTransformer {
  private readonly _models: ReadonlyDeep<DMMF.Model[]>;
  private readonly _spec: ViewsSpec;
  private _outputPath: string;

  constructor(args: {
    models: ReadonlyDeep<DMMF.Model[]>;
    spec: ViewsSpec;
    outputPath: string;
  }) {
    this._models = args.models;
    this._spec = args.spec;
    this._outputPath = args.outputPath;
  }

  async transform() {
    await this.generateSpecFile();

    for (const [modelName, modelViews] of Object.entries(this._spec)) {
      const dmmfModel = this._models.find((m) => m.name === modelName);
      if (!dmmfModel) continue;
      await this.generateModelViewsFile(modelName, modelViews, dmmfModel);
    }
  }

  private async generateSpecFile() {
    const modelEntries = this._models
      .map((m) => {
        return `  ${m.name}?: { [view: string]: { select: Prisma.${m.name}Select } };`;
      })
      .join("\n");

    const content = `
import type { Prisma } from "@prisma/client";

type TypedViewsSpec = {
${modelEntries}
};

export function defineViews<T extends TypedViewsSpec>(spec: T): T {
  return spec;
}
`;

    const filePath = path.join(this._outputPath, "spec.ts");
    await writeFileSafely(filePath, content, false);
  }

  private async generateModelViewsFile(
    modelName: string,
    modelViews: ViewsSpec[string],
    dmmfModel: ReadonlyDeep<DMMF.Model>,
  ) {
    const blocks: string[] = [
      `import type { Prisma } from "@prisma/client";`,
      "",
    ];

    for (const [viewName, viewSpec] of Object.entries(modelViews)) {
      const viewCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);
      const selectConstName = `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}${viewCapitalized}Select`;
      const viewTypeName = `${modelName}${viewCapitalized}View`;
      const dtoTypeName = `${modelName}${viewCapitalized}Dto`;
      const mapperName = `to${modelName}${viewCapitalized}Dto`;

      const serializedSelect = serializeSelectValue(viewSpec.select, 0);

      const dtoShape = buildDtoShape(
        viewSpec.select as Record<string, unknown>,
        dmmfModel,
        this._models,
      );

      const mapperBody = buildMapperBody(
        viewSpec.select as Record<string, unknown>,
        dmmfModel,
        this._models,
        "v",
      );

      blocks.push(
        `// --- ${viewName} view ---`,
        "",
        `export const ${selectConstName} = ${serializedSelect} as const satisfies Prisma.${modelName}Select;`,
        "",
        `export type ${viewTypeName} = Prisma.${modelName}GetPayload<{`,
        `  select: typeof ${selectConstName};`,
        `}>;`,
        "",
        `export type ${dtoTypeName} = ${dtoShape};`,
        "",
        `export function ${mapperName}(v: ${viewTypeName}): ${dtoTypeName} {`,
        `  return ${mapperBody};`,
        `}`,
        "",
      );
    }

    const content = blocks.join("\n");
    const filePath = path.join(this._outputPath, `${modelName}.views.ts`);
    await writeFileSafely(filePath, content, false);
  }
}
