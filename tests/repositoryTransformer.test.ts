import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";

vi.mock("../src/generators/utils/writeFileSafely", () => ({
  writeFileSafely: vi.fn().mockResolvedValue(undefined),
}));

import { RepositoryTransformer } from "../src/generators/repository/transformer";
import { writeFileSafely } from "../src/generators/utils/writeFileSafely";

const mockedWriteFileSafely = vi.mocked(writeFileSafely);

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

describe("Repository Transformer", () => {
  beforeEach(() => {
    mockedWriteFileSafely.mockClear();
  });

  describe("transform — basic model", () => {
    it("generates a repository file for a simple model", async () => {
      const model = makeModel("User", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      expect(mockedWriteFileSafely).toHaveBeenCalledTimes(1);
      const [filePath, content] = mockedWriteFileSafely.mock.calls[0];
      expect(filePath).toBe("/tmp/test-repo/User.repository.ts");
      expect(content).toContain("class UserRepository");
      expect(content).toContain("extends BaseRepository<UserModel>");
      expect(content).toContain("import { UserModel }");
    });
  });

  describe("transform — findBy methods", () => {
    it("generates findById for @id field", async () => {
      const model = makeModel("User", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("async findById(");
      expect(content).toContain("id: number");
      expect(content).toContain("findUnique");
    });

    it("generates findByXXX for @unique fields", async () => {
      const model = makeModel("User", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "email", type: "String", isUnique: true }),
        makeField({ name: "name", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("async findById(");
      expect(content).toContain("async findByEmail(");
      expect(content).toContain("email: string");
    });

    it("does not generate findById for @unique-only field", async () => {
      const model = makeModel("Book", [
        makeField({ name: "id", type: "Int", isUnique: true }),
        makeField({ name: "title", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      // id is @unique (not @id), so method name should be findById from unique, not from id
      expect(content).toContain("findById");
      // Should use findUnique
      expect(content).toContain("findUnique");
    });
  });

  describe("transform — composite unique", () => {
    it("generates findByXXXAndYYY for @@unique", async () => {
      const model = makeModel(
        "BookPost",
        [
          makeField({ name: "id", type: "Int", isId: true }),
          makeField({ name: "bookId", type: "Int" }),
          makeField({ name: "postId", type: "Int" }),
        ],
        { uniqueFields: [["bookId", "postId"]] },
      );

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("findByBookIdAndPostId");
      expect(content).toContain("bookId: number");
      expect(content).toContain("postId: number");
      expect(content).toContain("bookId_postId");
    });
  });

  describe("transform — WhereFilter types", () => {
    it("generates appropriate filter types for scalar fields", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "published", type: "Boolean" }),
        makeField({ name: "viewCount", type: "Int" }),
        makeField({ name: "createdAt", type: "DateTime" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("PostWhereFilter");
      // String filter should have contains, startsWith, endsWith
      expect(content).toContain("contains?:");
      expect(content).toContain("startsWith?:");
      // DateTime filter should have gte, lt, etc.
      expect(content).toContain("gte?:");
      expect(content).toContain("lt?:");
      // Boolean filter
      expect(content).toContain("equals?:");
    });

    it("generates array filter operators for list fields", async () => {
      const model = makeModel("ArrayModel", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "tags", type: "String", isList: true }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("has?:");
      expect(content).toContain("hasEvery?:");
      expect(content).toContain("hasSome?:");
      expect(content).toContain("isEmpty?:");
    });
  });

  describe("transform — enum fields", () => {
    it("imports enum types from @prisma/client", async () => {
      const model = makeModel("Item", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "status", type: "ItemStatus", kind: "enum" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain(
        "import { ItemStatus as PrismaItemStatus }",
      );
    });
  });

  describe("transform — pagination types", () => {
    it("generates paginate and cursorPaginate methods", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("PostPaginateArgs");
      expect(content).toContain("PostCursorPaginateArgs");
      expect(content).toContain("async paginate(");
      expect(content).toContain("async cursorPaginate(");
      expect(content).toContain("PostOrderBy");
    });
  });

  describe("transform — relation toModel", () => {
    it("generates toModel with relation setters when relations exist", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int", isRequired: false }),
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

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("toModel(record: any)");
      expect(content).toContain("record.author");
      expect(content).toContain("builder.author(");
    });

    it("generates simple toModel when no relations", async () => {
      const model = makeModel("Map", [
        makeField({ name: "key", type: "String", isId: true }),
        makeField({ name: "value", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("toModel(record: any)");
      expect(content).not.toContain("builder.");
    });
  });

  describe("transform — FK exclusion in WhereFilter", () => {
    it("excludes FK fields from WhereFilter and OrderBy", async () => {
      const model = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
        makeField({ name: "authorId", type: "Int", isRequired: false }),
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

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      // WhereFilter should not contain authorId
      const whereMatch = content.match(
        /export type PostWhereFilter = \{([^}]+)\}/,
      );
      if (whereMatch) {
        expect(whereMatch[1]).not.toContain("authorId");
      }
    });
  });

  describe("transform — multiple models", () => {
    it("generates one file per model", async () => {
      const models = [
        makeModel("User", [
          makeField({ name: "id", type: "Int", isId: true }),
        ]),
        makeModel("Post", [
          makeField({ name: "id", type: "Int", isId: true }),
        ]),
      ];

      const t = new RepositoryTransformer({
        models,
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      expect(mockedWriteFileSafely).toHaveBeenCalledTimes(2);
      expect(mockedWriteFileSafely.mock.calls[0][0]).toContain("User.repository.ts");
      expect(mockedWriteFileSafely.mock.calls[1][0]).toContain("Post.repository.ts");
    });
  });

  describe("transform — FindOptions parameter", () => {
    it("findBy methods accept optional FindOptions", async () => {
      const model = makeModel("User", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "email", type: "String", isUnique: true }),
      ]);

      const t = new RepositoryTransformer({
        models: [model],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("options?: FindOptions");
      expect(content).toContain("...options");
    });
  });

  describe("transform — view methods (spec)", () => {
    const userModel = makeModel("User", [
      makeField({ name: "id", type: "Int", isId: true }),
      makeField({ name: "email", type: "String" }),
      makeField({ name: "name", type: "String", isRequired: false }),
    ]);

    const spec = {
      User: {
        profile: {
          select: { id: true, email: true, name: true },
        },
      },
    };

    it("generates findByIdProfile / findManyProfile / paginateProfile", async () => {
      const t = new RepositoryTransformer({
        models: [userModel],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      t.setSpec({ spec });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("async findByIdProfile(");
      expect(content).toContain("async findManyProfile(");
      expect(content).toContain("async paginateProfile(");
    });

    it("imports view symbols from ../views/User.views", async () => {
      const t = new RepositoryTransformer({
        models: [userModel],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      t.setSpec({ spec });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("from '../views/User.views'");
      expect(content).toContain("userProfileSelect");
      expect(content).toContain("UserProfileRow");
      expect(content).toContain("UserProfileView");
      expect(content).toContain("UserProfileDto");
    });

    it("findByIdProfile uses select const and view class", async () => {
      const t = new RepositoryTransformer({
        models: [userModel],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      t.setSpec({ spec });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("select: userProfileSelect");
      expect(content).toContain("UserProfileView.fromPrismaValue(");
      expect(content).toContain(").toDto()");
      expect(content).toContain("Promise<UserProfileDto | null>");
    });

    it("paginateProfile returns PaginateResult<UserProfileDto>", async () => {
      const t = new RepositoryTransformer({
        models: [userModel],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      t.setSpec({ spec });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("Promise<PaginateResult<UserProfileDto>>");
      expect(content).toContain("totalPages: Math.ceil(total / perPage)");
    });

    it("generates no view methods when spec has no entry for model", async () => {
      const postModel = makeModel("Post", [
        makeField({ name: "id", type: "Int", isId: true }),
        makeField({ name: "title", type: "String" }),
      ]);

      const t = new RepositoryTransformer({
        models: [postModel],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      t.setSpec({ spec });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).not.toContain("findByIdProfile");
      expect(content).not.toContain("from '../views/");
    });

    it("generates methods for multiple views", async () => {
      const multiSpec = {
        User: {
          profile: { select: { id: true, name: true } },
          list: { select: { id: true, email: true } },
        },
      };

      const t = new RepositoryTransformer({
        models: [userModel],
        outputPath: "/tmp/test-repo",
        modelImportPath: "../model",
      });
      t.setSpec({ spec: multiSpec });
      await t.transform();

      const content = mockedWriteFileSafely.mock.calls[0][1] as string;
      expect(content).toContain("findByIdProfile");
      expect(content).toContain("findManyProfile");
      expect(content).toContain("paginateProfile");
      expect(content).toContain("findByIdList");
      expect(content).toContain("findManyList");
      expect(content).toContain("paginateList");
    });
  });
});
