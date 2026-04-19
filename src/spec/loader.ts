import path from "path";
import fs from "fs";
import { createJiti } from "jiti";
import type { ViewsSpec } from "./types";

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

export async function loadSpec(args: LoadSpecArgs): Promise<ViewsSpec> {
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

function validateSpec(input: unknown, sourcePath: string): ViewsSpec {
  if (!isPlainObject(input)) {
    throw new Error(
      `[Frourio Framework] spec file must export a ViewsSpec object as default (got ${typeOf(input)}) at ${sourcePath}`,
    );
  }

  for (const [modelName, modelViews] of Object.entries(input)) {
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
      if (!("select" in viewSpec) || !isPlainObject(viewSpec.select)) {
        throw new Error(
          `[Frourio Framework] spec: view "${modelName}.${viewName}" must have a "select" object`,
        );
      }
    }
  }

  return input as ViewsSpec;
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
