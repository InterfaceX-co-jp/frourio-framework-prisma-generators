import path from "path";
import fs from "fs";
import { createJiti } from "jiti";
import type { LoadedSpec, ViewsSpec } from "./types";

export type LoadSpecArgs = {
  /**
   * Spec file path as declared in the Prisma generator block. May be absolute
   * or relative to the schema file.
   */
  specPath: string;
  /**
   * `options.schemaPath` from the Prisma generator invocation. Used to resolve
   * relative spec paths.
   */
  schemaPath: string;
};

export async function loadSpec(args: LoadSpecArgs): Promise<LoadedSpec> {
  const absolute = path.isAbsolute(args.specPath)
    ? args.specPath
    : path.resolve(path.dirname(args.schemaPath), args.specPath);

  if (!fs.existsSync(absolute)) {
    throw new Error(
      `[Frourio Framework] spec file not found: ${absolute}`,
    );
  }

  const jiti = createJiti(__filename, { interopDefault: true });
  const loaded = await jiti.import<unknown>(absolute, { default: true });

  return validateSpec(loaded, absolute);
}

function validateSpec(input: unknown, sourcePath: string): LoadedSpec {
  if (!isPlainObject(input)) {
    throw new Error(
      `[Frourio Framework] spec file must export a ViewsSpec object as default (got ${typeOf(input)}) at ${sourcePath}`,
    );
  }

  // New format from registerModels
  if ((input as any)._type === "LoadedSpec") {
    const loaded = input as any;
    if (!isPlainObject(loaded.views)) {
      throw new Error(
        `[Frourio Framework] spec LoadedSpec.views must be an object at ${sourcePath}`,
      );
    }
    validateViewsSpec(loaded.views, sourcePath);
    return loaded as LoadedSpec;
  }

  // Legacy format: plain ViewsSpec from defineViews
  validateViewsSpec(input as ViewsSpec, sourcePath);
  return {
    _type: "LoadedSpec",
    views: input as ViewsSpec,
    base: {},
  };
}

function validateViewsSpec(views: ViewsSpec, _sourcePath: string): void {
  for (const [modelName, modelViews] of Object.entries(views)) {
    if (!isPlainObject(modelViews)) {
      throw new Error(
        `[Frourio Framework] spec: model "${modelName}" must be an object of views (got ${typeOf(modelViews)})`,
      );
    }

    for (const [viewName, viewSpec] of Object.entries(modelViews)) {
      if (!isPlainObject(viewSpec)) {
        throw new Error(
          `[Frourio Framework] spec: view "${modelName}.${viewName}" must be an object (got ${typeOf(viewSpec)})`,
        );
      }
      const isRaw = "raw" in viewSpec && "map" in viewSpec;
      if (!isRaw && (!("select" in viewSpec) || !isPlainObject(viewSpec.select))) {
        throw new Error(
          `[Frourio Framework] spec: view "${modelName}.${viewName}" must have a "select" object or "raw"+"map" functions`,
        );
      }
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
