import type { DMMF } from "@prisma/generator-helper";
import type { ReadonlyDeep } from "../utils/types";
import { writeFileSafely } from "../utils/writeFileSafely";
import type { ViewsSpec, TransformValue, TransformStaticMap, ComputedFieldDefinition } from "../../spec/types";
import { isRawViewSpec } from "../../spec/types";
import { parseFieldDtoAnnotation } from "../model/lib/dto/parseFieldDtoAnnotation";
import path from "path";
import fs from "fs";

function isStaticMap(v: TransformValue): v is TransformStaticMap {
  return typeof v === "object" && v !== null;
}

/**
 * Derives the base const name for a transform.
 * viewName="detail", fieldPath="students.attendance"
 * → "_detailStudentsAttendance"
 */
function transformBaseName(viewName: string, fieldPath: string): string {
  const pathPascal = fieldPath
    .split(".")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  return `_${viewName}${pathPascal}`;
}

function computedBaseName(viewName: string, fieldName: string): string {
  const namePascal = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  return `_${viewName}${namePascal}`;
}

function generateComputedDecl(
  viewName: string,
  fieldName: string,
  def: ComputedFieldDefinition,
): string {
  const base = computedBaseName(viewName, fieldName);
  return `const ${base}Computed = ${def.from.toString()};`;
}

function generateTransformDecl(
  viewName: string,
  fieldPath: string,
  transform: TransformValue,
): string {
  const base = transformBaseName(viewName, fieldPath);
  if (isStaticMap(transform)) {
    return `const ${base}Map = ${JSON.stringify(transform)} as const;`;
  }
  return `const ${base}Transform = ${transform.toString()};`;
}

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

/** Extract annotation map or hide flag for a field, falling back to undefined. */
function getFieldAnnotation(field: ReadonlyDeep<DMMF.Field> | undefined) {
  if (!field) return undefined;
  return parseFieldDtoAnnotation({ field });
}

function buildDtoShape(
  select: Record<string, unknown>,
  model: ReadonlyDeep<DMMF.Model>,
  models: ReadonlyDeep<DMMF.Model[]>,
  viewName: string,
  transforms: Record<string, TransformValue>,
  pathPrefix: string,
  computed?: Record<string, ComputedFieldDefinition>,
): string {
  const fields = Object.entries(select).map(([key, val]) => {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const dmmfField = model.fields.find((f) => f.name === key);
    const specTransform = transforms[currentPath];
    const annotation = getFieldAnnotation(dmmfField);

    // @dto.hide hides field unless spec has explicit transform (spec > annotation)
    if (!specTransform && annotation?.hide) {
      return null;
    }

    // Effective transform: spec wins, fallback to annotation map
    const effectiveTransform: TransformValue | undefined =
      specTransform ?? (annotation?.map ? annotation.map : undefined);

    if (val === true) {
      if (effectiveTransform) {
        const base = transformBaseName(viewName, currentPath);
        const nullable = dmmfField && !dmmfField.isRequired ? " | null" : "";
        if (isStaticMap(effectiveTransform)) {
          const union = Object.values(effectiveTransform)
            .map((v) => JSON.stringify(v))
            .join(" | ");
          return `${key}: ${union}${nullable}`;
        }
        return `${key}: ReturnType<typeof ${base}Transform>${nullable}`;
      }
      if (!dmmfField) return `${key}: unknown`;
      const base = scalarToTs(dmmfField);
      const nullable = !dmmfField.isRequired ? " | null" : "";
      return `${key}: ${dmmfField.isList ? `Array<${base}>` : base}${nullable}`;
    }

    if (typeof val === "object" && val !== null && "select" in val) {
      const nestedSelect = (val as { select: Record<string, unknown> }).select;
      const relatedModel = models.find((m) => m.name === dmmfField?.type);
      if (!relatedModel || !dmmfField) return `${key}: unknown`;
      const shape = buildDtoShape(
        nestedSelect,
        relatedModel,
        models,
        viewName,
        transforms,
        currentPath,
      );
      const nullable = !dmmfField.isRequired ? " | null" : "";
      return dmmfField.isList
        ? `${key}: Array<${shape}>${nullable}`
        : `${key}: ${shape}${nullable}`;
    }

    return `${key}: unknown`;
  }).filter((f): f is string => f !== null);

  if (!pathPrefix && computed) {
    for (const [key, def] of Object.entries(computed)) {
      fields.push(`${key}: ${def.type}`);
    }
  }

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
  viewName: string,
  transforms: Record<string, TransformValue>,
  varName: string,
  pathPrefix: string,
  computed?: Record<string, ComputedFieldDefinition>,
): string {
  const fields = Object.entries(select).map(([key, val]) => {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const dmmfField = model.fields.find((f) => f.name === key);
    const specTransform = transforms[currentPath];
    const annotation = getFieldAnnotation(dmmfField);

    // @dto.hide hides field unless spec has explicit transform
    if (!specTransform && annotation?.hide) {
      return null;
    }

    // Effective transform: spec wins, fallback to annotation map
    const effectiveTransform: TransformValue | undefined =
      specTransform ?? (annotation?.map ? annotation.map : undefined);

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
          viewName,
          transforms,
          "item",
          currentPath,
        );
        return `${key}: ${varName}.${key}.map((item) => (${innerBody}))`;
      }
    }

    if (effectiveTransform) {
      const base = transformBaseName(viewName, currentPath);
      if (isStaticMap(effectiveTransform)) {
        return `${key}: ${base}Map[${varName}.${key} as keyof typeof ${base}Map]`;
      }
      return `${key}: ${base}Transform(${varName}.${key})`;
    }

    return `${key}: ${varName}.${key}`;
  }).filter((f): f is string => f !== null);

  if (!pathPrefix && computed) {
    for (const [key] of Object.entries(computed)) {
      const base = computedBaseName(viewName, key);
      fields.push(`${key}: ${base}Computed(${varName})`);
    }
  }

  return `{ ${fields.join(", ")} }`;
}

export class ViewsTransformer {
  private readonly _models: ReadonlyDeep<DMMF.Model[]>;
  private readonly _spec: ViewsSpec;
  private _outputPath: string;
  private _generatedFiles: string[] = [];

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
    this._generatedFiles = [];
    await this.generateSpecFile();

    for (const [modelName, modelViews] of Object.entries(this._spec)) {
      const dmmfModel = this._models.find((m) => m.name === modelName);
      if (!dmmfModel) continue;
      await this.generateModelViewsFile(modelName, modelViews, dmmfModel);
    }

    await this._writeViewsIndex();
  }

  private async _writeViewsIndex() {
    const indexPath = path.join(this._outputPath, "index.ts");
    const rows = this._generatedFiles.map((filePath) => {
      let relativePath = path.relative(path.dirname(indexPath), filePath);
      if (relativePath.endsWith(".ts")) {
        relativePath = relativePath.slice(0, -3);
      }
      return `export * from './${relativePath.replace(/\\/g, "/")}';`;
    });
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, rows.join("\n"));
  }

  private async generateSpecFile() {
    const modelEntries = this._models
      .map((m) => {
        return `  ${m.name}?: {\n    [view: string]: {\n      select: Prisma.${m.name}Select;\n      transforms?: Record<string, ((v: any) => unknown) | Record<string, string>>;\n      computed?: Record<string, { type: string; from: (v: any) => unknown }>;\n    }\n  };`;
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
    const blocks: string[] = [`import type { Prisma } from "@prisma/client";`, ""];

    // Emit transform and computed consts (grouped before all view blocks)
    const declLines: string[] = [];
    for (const [viewName, viewSpec] of Object.entries(modelViews)) {
      if (isRawViewSpec(viewSpec)) {
        // Raw views: serialize raw and map functions
        declLines.push(`const _${viewName}Raw = ${viewSpec.raw.toString()};`);
        declLines.push(`const _${viewName}Map = ${viewSpec.map.toString()};`);
        continue;
      }
      if (viewSpec.transforms) {
        for (const [fieldPath, transform] of Object.entries(viewSpec.transforms)) {
          declLines.push(generateTransformDecl(viewName, fieldPath, transform));
        }
      }
      // Annotation-level maps for fields in this view's select
      this._emitAnnotationTransformDecls(viewName, viewSpec.select as Record<string, unknown>, dmmfModel, viewSpec.transforms ?? {}, declLines);
      if (viewSpec.computed) {
        for (const [fieldName, def] of Object.entries(viewSpec.computed)) {
          declLines.push(generateComputedDecl(viewName, fieldName, def));
        }
      }
    }
    if (declLines.length > 0) {
      blocks.push(...declLines, "");
    }

    for (const [viewName, viewSpec] of Object.entries(modelViews)) {
      const viewCapitalized =
        viewName.charAt(0).toUpperCase() + viewName.slice(1);
      const dtoTypeName = `${modelName}${viewCapitalized}Dto`;

      blocks.push(`// --- ${viewName} view ---`, "");

      if (isRawViewSpec(viewSpec)) {
        // Raw view: DTO type inferred from map's return type
        blocks.push(
          `export type ${dtoTypeName} = ReturnType<typeof _${viewName}Map>;`,
          "",
          `export async function find${modelName}${viewCapitalized}Raw(prisma: any, args: any): Promise<${dtoTypeName} | null> {`,
          `  const row = await _${viewName}Raw(prisma, args);`,
          `  return row ? _${viewName}Map(row) : null;`,
          `}`,
          "",
        );
        continue;
      }

      const selectConstName = `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}${viewCapitalized}Select`;
      const viewTypeName = `${modelName}${viewCapitalized}View`;
      const mapperName = `to${modelName}${viewCapitalized}Dto`;

      const transforms = viewSpec.transforms ?? {};
      const computed = viewSpec.computed;
      const serializedSelect = serializeSelectValue(viewSpec.select, 0);

      const dtoShape = buildDtoShape(
        viewSpec.select as Record<string, unknown>,
        dmmfModel,
        this._models,
        viewName,
        transforms,
        "",
        computed,
      );

      const mapperBody = buildMapperBody(
        viewSpec.select as Record<string, unknown>,
        dmmfModel,
        this._models,
        viewName,
        transforms,
        "v",
        "",
        computed,
      );

      blocks.push(
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
    this._generatedFiles.push(filePath);
  }

  /**
   * Emit static map consts for fields that have @dto.map annotations
   * and no spec-level transform defined.
   */
  private _emitAnnotationTransformDecls(
    viewName: string,
    select: Record<string, unknown>,
    model: ReadonlyDeep<DMMF.Model>,
    specTransforms: Record<string, TransformValue>,
    out: string[],
    pathPrefix = "",
  ) {
    for (const [key, val] of Object.entries(select)) {
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (specTransforms[currentPath]) continue;
      const dmmfField = model.fields.find((f) => f.name === key);
      const annotation = getFieldAnnotation(dmmfField);
      if (annotation?.map) {
        const base = transformBaseName(viewName, currentPath);
        out.push(`const ${base}Map = ${JSON.stringify(annotation.map)} as const;`);
      }
      if (
        typeof val === "object" &&
        val !== null &&
        "select" in val &&
        dmmfField
      ) {
        const relatedModel = this._models.find((m) => m.name === dmmfField.type);
        if (relatedModel) {
          this._emitAnnotationTransformDecls(
            viewName,
            (val as { select: Record<string, unknown> }).select,
            relatedModel,
            specTransforms,
            out,
            currentPath,
          );
        }
      }
    }
  }
}
