import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";

vi.mock("../src/generators/utils/writeFileSafely", () => ({
  writeFileSafely: vi.fn().mockResolvedValue(undefined),
}));

import { ViewsTransformer } from "../src/generators/views";
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

function findContent(filename: string): string {
  const call = mockedWriteFileSafely.mock.calls.find(([p]) =>
    (p as string).endsWith(filename),
  );
  if (!call) throw new Error(`No generated file found for ${filename}`);
  return call[1] as string;
}

const postFields = [
  makeField({ name: "id", type: "Int", isId: true }),
  makeField({ name: "title", type: "String" }),
  makeField({ name: "published", type: "Boolean" }),
];

const userFields = [
  makeField({ name: "id", type: "Int", isId: true }),
  makeField({ name: "email", type: "String" }),
  makeField({ name: "name", type: "String", isRequired: false }),
  makeField({
    name: "posts",
    type: "Post",
    kind: "object",
    isList: true,
    isRequired: true,
    relationName: "UserPosts",
  } as any),
];

const postModel = makeModel("Post", postFields);
const userModel = makeModel("User", userFields);

describe("ViewsTransformer", () => {
  beforeEach(() => {
    mockedWriteFileSafely.mockClear();
  });

  it("generates spec.ts with TypedViewsSpec + typed defineViews", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          listItem: { select: { id: true, email: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const spec = findContent("spec.ts");
    expect(spec).toContain("TypedViewsSpec");
    expect(spec).toContain("Prisma.UserSelect");
    expect(spec).toContain("Prisma.PostSelect");
    expect(spec).toContain("export function defineViews");
  });

  it("generates <Model>.views.ts with Select const", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          listItem: { select: { id: true, email: true, name: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    expect(content).toContain("userListItemSelect");
    expect(content).toContain("as const satisfies Prisma.UserSelect");
    expect(content).toContain("id: true");
    expect(content).toContain("email: true");
  });

  it("generates View type using GetPayload", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          listItem: { select: { id: true, email: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    expect(content).toContain("UserListItemView");
    expect(content).toContain("Prisma.UserGetPayload");
    expect(content).toContain("typeof userListItemSelect");
  });

  it("generates Dto type with correct scalar types", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          listItem: { select: { id: true, email: true, name: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    expect(content).toContain("UserListItemDto");
    expect(content).toContain("id: number");
    expect(content).toContain("email: string");
    expect(content).toContain("name: string | null");
  });

  it("generates mapper function", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          listItem: { select: { id: true, email: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    expect(content).toContain("toUserListItemDto");
    expect(content).toContain("(v: UserListItemView): UserListItemDto");
    expect(content).toContain("v.id");
    expect(content).toContain("v.email");
  });

  it("handles nested select (relation field)", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          profile: {
            select: {
              id: true,
              email: true,
              posts: {
                select: { id: true, title: true, published: true },
              },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    // Dto should have nested array type
    expect(content).toContain("Array<");
    expect(content).toContain("id: number");
    expect(content).toContain("title: string");
    expect(content).toContain("published: boolean");
  });

  it("handles nullable fields with | null", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          profile: { select: { id: true, name: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    expect(content).toContain("name: string | null");
  });

  it("generates files for multiple views per model", async () => {
    const vt = new ViewsTransformer({
      models: [userModel, postModel],
      spec: {
        User: {
          profile: { select: { id: true, email: true } },
          listItem: { select: { id: true } },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("User.views.ts");
    expect(content).toContain("userProfileSelect");
    expect(content).toContain("userListItemSelect");
    expect(content).toContain("UserProfileView");
    expect(content).toContain("UserListItemView");
  });
});
