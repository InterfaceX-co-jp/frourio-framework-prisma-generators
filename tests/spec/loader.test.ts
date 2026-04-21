import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadSpec } from "../../src/spec/loader";

describe("loadSpec", () => {
  let tmpDir: string;
  let schemaPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-loader-"));
    schemaPath = path.join(tmpDir, "schema.prisma");
    fs.writeFileSync(schemaPath, "// placeholder prisma schema");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeSpec = (fileName: string, contents: string) => {
    const file = path.join(tmpDir, fileName);
    fs.writeFileSync(file, contents);
    return file;
  };

  it("loads a TS spec file relative to the schema path", async () => {
    writeSpec(
      "dto.spec.ts",
      `import { defineViews } from "${srcSpecImport()}";
       export default defineViews({
         User: {
           customer: { select: { id: true, name: true } },
         },
       });`,
    );

    const spec = await loadSpec({ specPath: "dto.spec.ts", schemaPath });

    expect(spec._type).toBe("LoadedSpec");
    expect(spec.views).toEqual({
      User: {
        customer: { select: { id: true, name: true } },
      },
    });
  });

  it("loads from an absolute path", async () => {
    const abs = writeSpec(
      "abs.spec.ts",
      `export default { Store: { listItem: { select: { id: true } } } };`,
    );

    const spec = await loadSpec({ specPath: abs, schemaPath });

    expect((spec.views.Store?.listItem as any)?.select).toEqual({ id: true });
  });

  it("throws when the spec file does not exist", async () => {
    await expect(
      loadSpec({ specPath: "missing.spec.ts", schemaPath }),
    ).rejects.toThrow(/spec file not found/);
  });

  it("rejects a non-object default export", async () => {
    writeSpec("bad.spec.ts", `export default 42;`);

    await expect(
      loadSpec({ specPath: "bad.spec.ts", schemaPath }),
    ).rejects.toThrow(/must export a ViewsSpec object/);
  });

  it("rejects a view missing a select property", async () => {
    writeSpec(
      "no-select.spec.ts",
      `export default { User: { customer: { } } };`,
    );

    await expect(
      loadSpec({ specPath: "no-select.spec.ts", schemaPath }),
    ).rejects.toThrow(/must have a "select" object/);
  });

  it("loads a dto.config.ts using registerModelDtos + defineModelDto", async () => {
    const defineModelDtoPath = path.resolve(__dirname, "../../src/spec/defineModelDto");
    const registerModelDtosPath = path.resolve(__dirname, "../../src/spec/registerModelDtos");

    writeSpec(
      "dto.config.ts",
      `import { defineModelDto } from "${defineModelDtoPath}";
       import { registerModelDtos } from "${registerModelDtosPath}";
       export default registerModelDtos([
         defineModelDto("User", {
           views: { customer: { select: { id: true, name: true } } },
         }),
       ]);`,
    );

    const spec = await loadSpec({
      specPath: "dto.config.ts",
      schemaPath,
    });

    expect(spec._type).toBe("LoadedSpec");
    expect(spec.views).toEqual({
      User: { customer: { select: { id: true, name: true } } },
    });
  });

  it("loads base config from registerModelDtos", async () => {
    const defineModelDtoPath = path.resolve(__dirname, "../../src/spec/defineModelDto");
    const registerModelDtosPath = path.resolve(__dirname, "../../src/spec/registerModelDtos");

    writeSpec(
      "with-base.config.ts",
      `import { defineModelDto } from "${defineModelDtoPath}";
       import { registerModelDtos } from "${registerModelDtosPath}";
       export default registerModelDtos([
         defineModelDto("User", {
           views: { profile: { select: { id: true } } },
           base: {
             fields: { password: { hide: true } },
             profiles: [{ name: "Public", pick: ["id", "email"] }],
           },
         }),
       ]);`,
    );

    const spec = await loadSpec({
      specPath: "with-base.config.ts",
      schemaPath,
    });

    expect(spec.base.User).toEqual({
      fields: { password: { hide: true } },
      profiles: [{ name: "Public", pick: ["id", "email"] }],
    });
  });
});

function srcSpecImport(): string {
  return path.resolve(__dirname, "../../src/spec/defineViews");
}
