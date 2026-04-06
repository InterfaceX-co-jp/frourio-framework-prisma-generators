import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";

// Mock writeFileSafely to capture generated output without writing files
vi.mock("../src/generators/utils/writeFileSafely", () => ({
  writeFileSafely: vi.fn().mockResolvedValue(undefined),
}));

import Transformer from "../src/generators/model/transformer";
import { writeFileSafely } from "../src/generators/utils/writeFileSafely";

const mockedWriteFileSafely = vi.mocked(writeFileSafely);

// =========================================
// Helpers to create DMMF-like test fixtures
// =========================================

const makeField = (
  overrides: Partial<PrismaDMMF.Field> & { name: string; type: string },
): PrismaDMMF.Field =>
  ({
    kind: "scalar",
    isList: false,
    isRequired: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    hasDefaultValue: false,
    isGenerated: false,
    isUpdatedAt: false,
    ...overrides,
  }) as PrismaDMMF.Field;

const makeModel = (
  name: string,
  fields: PrismaDMMF.Field[],
  overrides: Partial<PrismaDMMF.Model> = {},
): PrismaDMMF.Model =>
  ({
    name,
    dbName: null,
    fields,
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    isGenerated: false,
    ...overrides,
  }) as PrismaDMMF.Model;

/** Helper: find the generated content for a given model file name */
function findModelContent(filename: string): string {
  const call = mockedWriteFileSafely.mock.calls.find(([path]) =>
    (path as string).endsWith(filename),
  );
  if (!call) throw new Error(`No generated file found for ${filename}`);
  return call[1] as string;
}

describe("Model Transformer", () => {
  beforeEach(() => {
    mockedWriteFileSafely.mockClear();
  });

  describe("transform — basic model", () => {
    it("generates a file for a simple scalar model", async () => {
      const model = makeModel("Map", [
        makeField({ name: "key", type: "String", isId: true }),
        makeField({ name: "value", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      // 1 model + _shared.ts + index.ts = 3 calls
      expect(mockedWriteFileSafely).toHaveBeenCalledTimes(3);
      const content = findModelContent("Map.model.ts");

      // Should contain model class
      expect(content).toContain("export class MapModel");
      // Should contain DTO type
      expect(content).toContain("export type MapModelDto");
      // Should contain constructor args type
      expect(content).toContain("export type MapModelConstructorArgs");
      // Should contain builder
      expect(content).toContain("export class MapModelBuilder");
      // Should contain fromPrismaValue
      expect(content).toContain("static fromPrismaValue");
      // Should contain toDto
      expect(content).toContain("toDto(): MapModelDto");
    });
  });

  describe("transform — type mapping", () => {
    it("maps Prisma scalar types correctly in DTO", async () => {
      const model = makeModel("TypeTest", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
        makeField({ name: "active", type: "Boolean" }),
        makeField({ name: "score", type: "Float" }),
        makeField({ name: "amount", type: "Decimal" }),
        makeField({ name: "createdAt", type: "DateTime" }),
        makeField({ name: "likes", type: "BigInt" }),
        makeField({ name: "data", type: "Bytes" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("TypeTest.model.ts");

      // Constructor args should map Decimal → number, BigInt → bigint, etc.
      expect(content).toContain("number"); // Int, Float, Decimal
      expect(content).toContain("string"); // String
      expect(content).toContain("boolean"); // Boolean
      expect(content).toContain("Date"); // DateTime in constructor
      expect(content).toContain("bigint"); // BigInt
      expect(content).toContain("ArrayBuffer"); // Bytes

      // DTO should serialize DateTime/BigInt/Bytes to string
      expect(content).toContain("toISOString()");
      expect(content).toContain(".toString()");
      expect(content).toContain("Buffer.from");
    });
  });

  describe("transform — nullable fields", () => {
    it("renders optional marker and null union for nullable fields", async () => {
      const model = makeModel("NullTest", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String", isRequired: false }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("NullTest.model.ts");
      expect(content).toContain("name?");
      expect(content).toContain("| null");
    });
  });

  describe("transform — relation FK exclusion", () => {
    it("excludes FK fields from generated output", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int", isRequired: false }),
        makeField({
          name: "author",
          type: "User",
          isRequired: false,
          kind: "object",
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");

      // authorId should be excluded since it's a FK
      // Check that "authorId" does NOT appear as a standalone field
      // It may appear in import statements, so check the DTO type specifically
      expect(content).toContain("title");
      // The authorId should be filtered out of the field lists
      const dtoMatch = content.match(
        /export type PostModelDto = \{([^}]+)\}/,
      );
      if (dtoMatch) {
        expect(dtoMatch[1]).not.toContain("authorId");
      }
    });
  });

  describe("transform — @dto(hidden: true)", () => {
    it("excludes hidden fields from DTO type and toDto", async () => {
      const model = makeModel("User", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "email", type: "String" }),
        makeField({
          name: "password",
          type: "String",
          documentation: "@dto(hidden: true)",
        }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("User.model.ts");

      // password should NOT appear in DTO type
      const dtoMatch = content.match(
        /export type UserModelDto = \{([^}]+)\}/,
      );
      if (dtoMatch) {
        expect(dtoMatch[1]).not.toContain("password");
      }

      // But password should still be in the model class (private field)
      expect(content).toContain("_password");
    });
  });

  describe("transform — @json annotation", () => {
    it("uses custom JSON type when @json annotation is present", async () => {
      const model = makeModel("JsonModel", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({
          name: "data",
          type: "Json",
          documentation: "@json(type: [MyJsonType])",
        }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("JsonModel.model.ts");
      expect(content).toContain("MyJsonType");
      // Should import the additional type
      expect(content).toContain("import");
    });
  });

  describe("transform — @default / @updatedAt fields", () => {
    it("makes fields with hasDefaultValue optional in model fields", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true, hasDefaultValue: true }),
        makeField({ name: "title", type: "String" }),
        makeField({
          name: "createdAt",
          type: "DateTime",
          hasDefaultValue: true,
        }),
        makeField({
          name: "updatedAt",
          type: "DateTime",
          isUpdatedAt: true,
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      // createdAt and updatedAt should be optional in constructor args
      expect(content).toContain("createdAt?");
      expect(content).toContain("updatedAt?");
      // title should remain required
      expect(content).toMatch(/title[^?]/);
    });
  });

  describe("transform — enum fields", () => {
    it("imports and uses Prisma enum type", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({
          name: "status",
          type: "ItemStatus",
          kind: "enum",
        }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Item.model.ts");
      expect(content).toContain("PrismaItemStatus");
    });
  });

  describe("transform — array fields", () => {
    it("renders list types correctly", async () => {
      const model = makeModel("ArrayModel", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "tags", type: "String", isList: true }),
        makeField({ name: "scores", type: "Int", isList: true }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("ArrayModel.model.ts");
      expect(content).toContain("string[]");
      expect(content).toContain("number[]");
    });
  });

  describe("transform — DTO profiles", () => {
    it("generates profile DTO types and methods", async () => {
      const model = makeModel(
        "User",
        [
          makeField({ name: "id", type: "Int", isId: true }),
          makeField({ name: "email", type: "String" }),
          makeField({ name: "name", type: "String", isRequired: false }),
          makeField({
            name: "password",
            type: "String",
            documentation: "@dto(hidden: true)",
          }),
        ],
        {
          documentation:
            "@dto.profile(name: Public, pick: [id, email, name])",
        },
      );

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("User.model.ts");
      expect(content).toContain("export type UserPublicDto");
      expect(content).toContain("toPublicDto(): UserPublicDto");
    });
  });

  describe("transform — multiple models", () => {
    it("generates one file per model", async () => {
      const models = [
        makeModel("User", [
          makeField({ name: "id", type: "Int", isId: true }),
          makeField({ name: "name", type: "String" }),
        ]),
        makeModel("Post", [
          makeField({ name: "id", type: "Int", isId: true }),
          makeField({ name: "title", type: "String" }),
        ]),
      ];

      const t = new Transformer({ models });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      // 2 models + _shared.ts + index.ts = 4 calls
      expect(mockedWriteFileSafely).toHaveBeenCalledTimes(4);
      const filePaths = mockedWriteFileSafely.mock.calls.map(([p]) => p);
      expect(filePaths).toContainEqual(expect.stringContaining("User.model.ts"));
      expect(filePaths).toContainEqual(expect.stringContaining("Post.model.ts"));
      expect(filePaths).toContainEqual(expect.stringContaining("_shared.ts"));
      expect(filePaths).toContainEqual(expect.stringContaining("index.ts"));
    });
  });

  describe("transform — _shared.ts generation", () => {
    it("generates _shared.ts with PartialBy and WithIncludes types", async () => {
      const userModel = makeModel("User", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
        makeField({
          name: "posts",
          type: "Post",
          kind: "object",
          isList: true,
          relationName: "UserToPost",
        } as any),
      ]);
      const postModel = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "UserToPost",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [userModel, postModel] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const shared = findModelContent("_shared.ts");
      expect(shared).toContain("export type PartialBy<T, K extends keyof T>");
      expect(shared).toContain("export type PostWithIncludes");
      expect(shared).toContain("export type UserWithIncludes");

      // No duplicate WithIncludes
      const postMatches = shared.match(/export type PostWithIncludes/g);
      expect(postMatches).toHaveLength(1);
    });
  });

  describe("transform — index.ts barrel", () => {
    it("re-exports all model files and _shared", async () => {
      const models = [
        makeModel("User", [
          makeField({ name: "id", type: "Int", isId: true }),
        ]),
        makeModel("Post", [
          makeField({ name: "id", type: "Int", isId: true }),
        ]),
      ];

      const t = new Transformer({ models });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const indexContent = findModelContent("index.ts");
      expect(indexContent).toContain("export * from './User.model'");
      expect(indexContent).toContain("export * from './Post.model'");
      expect(indexContent).toContain("export * from './_shared'");
    });
  });

  describe("transform — BigInt/Bytes DTO serialization", () => {
    it("serializes BigInt to string and Bytes to base64 in DTO", async () => {
      const model = makeModel("Media", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "likes", type: "BigInt" }),
        makeField({ name: "data", type: "Bytes" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Media.model.ts");
      // DTO types should be string
      const dtoMatch = content.match(
        /export type MediaModelDto = \{([^}]+)\}/,
      );
      expect(dtoMatch).toBeTruthy();
      expect(dtoMatch![1]).toMatch(/likes[^:]*:\s*string/);
      expect(dtoMatch![1]).toMatch(/data[^:]*:\s*string/);

      // toDto should convert BigInt with .toString()
      expect(content).toContain(".toString()");
      // toDto should convert Bytes with Buffer.from
      expect(content).toContain("Buffer.from(");
      expect(content).toContain("toString('base64')");
    });
  });

  describe("transform — fromPrismaValue auto-extracts relations", () => {
    it("falls back to self for relations when args not provided", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      // Relation args should be optional
      expect(content).toMatch(/author\?\s*:/);
      // fromPrismaValue should fall back to self
      expect(content).toContain("args.self.author as any");
    });
  });

  describe("transform — builder fromPrisma includes relations", () => {
    it("extracts relations from Prisma value in builder", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      expect(content).toContain("(value as any).author");
    });
  });

  describe("transform — shared imports", () => {
    it("imports WithIncludes from _shared instead of defining locally", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      expect(content).toContain("from './_shared'");
      expect(content).not.toContain("const includeUser");
    });
  });

  describe("transform — builder class", () => {
    it("generates builder with scalar setters and build method", async () => {
      const model = makeModel("Map", [
        makeField({ name: "key", type: "String", isId: true }),
        makeField({ name: "value", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Map.model.ts");
      expect(content).toContain("class MapModelBuilder");
      expect(content).toContain("build(): MapModel");
      expect(content).toContain("fromPrisma(");
      expect(content).toContain("protected buildArgs()");
    });

    it("builder validates required fields", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Item.model.ts");
      expect(content).toContain('"name" is required');
    });
  });

  describe("transform — getter return types", () => {
    it("generates explicit return type annotations on getters", async () => {
      const model = makeModel("Typed", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
        makeField({ name: "bio", type: "String", isRequired: false }),
        makeField({ name: "createdAt", type: "DateTime", hasDefaultValue: true }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Typed.model.ts");
      // Required field should have explicit return type
      expect(content).toMatch(/get id\(\):\s*number/);
      expect(content).toMatch(/get name\(\):\s*string/);
      // Nullable field should include null | undefined
      expect(content).toMatch(/get bio\(\):\s*string \| null \| undefined/);
      // Field with default should include undefined
      expect(content).toMatch(/get createdAt\(\):\s*Date \| undefined/);
    });

    it("generates return types for relation getters", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "tags",
          type: "Tag",
          kind: "object",
          isList: true,
          relationName: "PostToTag",
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      // Optional relation should have null | undefined
      expect(content).toMatch(/get author\(\):\s*UserWithIncludes \| null \| undefined/);
      // List relation should have array type
      expect(content).toMatch(/get tags\(\):\s*TagWithIncludes\[\]/);
    });
  });

  describe("transform — equals method", () => {
    it("generates equals method that compares all fields", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Item.model.ts");
      expect(content).toContain("equals(other: ItemModel): boolean");
      expect(content).toContain("this._id === other._id");
      expect(content).toContain("this._name === other._name");
    });

    it("excludes FK fields from equals comparison", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      expect(content).toContain("equals(other: PostModel): boolean");
      expect(content).not.toContain("this._authorId === other._authorId");
    });
  });

  describe("transform — clone method", () => {
    it("generates clone method that creates a new model instance", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Item.model.ts");
      expect(content).toContain("clone(): ItemModel");
      expect(content).toContain("new ItemModel(");
      expect(content).toContain("id: this._id");
      expect(content).toContain("name: this._name");
    });
  });

  describe("transform — builder merge method", () => {
    it("generates merge method that copies from an existing model", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Item.model.ts");
      expect(content).toContain("merge(model: ItemModel): this");
      expect(content).toContain("this._args.id = model.id");
      expect(content).toContain("this._args.name = model.name");
    });

    it("excludes FK fields from merge", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int" }),
        makeField({
          name: "author",
          type: "User",
          kind: "object",
          isRequired: false,
          relationName: "PostToUser",
          relationFromFields: ["authorId"],
          relationToFields: ["id"],
        } as any),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Post.model.ts");
      expect(content).toContain("merge(model: PostModel): this");
      expect(content).not.toMatch(/this\._args\.authorId\s*=\s*model\.authorId/);
    });
  });

  describe("transform — builder fromPartial method", () => {
    it("generates fromPartial method", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new Transformer({ models: [model] });
      t.setOutputPath({ path: "/tmp/test-output" });
      await t.transform();

      const content = findModelContent("Item.model.ts");
      expect(content).toContain("fromPartial(args: Partial<ItemModelConstructorArgs>): this");
      expect(content).toContain("Object.assign(this._args, args)");
    });
  });
});
