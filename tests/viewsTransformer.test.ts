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
    expect(content).toContain("export class UserListItemView");
    expect(content).toContain("static fromPrismaValue(row: UserListItemRow): UserListItemView");
    expect(content).toContain("toDto(): UserListItemDto");
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

// ─── Phase 2: transforms ────────────────────────────────────────────────────

const lessonStudentFields = [
  makeField({ name: "id", type: "Int", isId: true }),
  makeField({ name: "attendance", type: "String" }),
  makeField({ name: "note", type: "String", isRequired: false }),
];

const lessonFields = [
  makeField({ name: "id", type: "Int", isId: true }),
  makeField({ name: "date", type: "String" }),
  makeField({ name: "status", type: "String" }),
  makeField({
    name: "students",
    type: "LessonStudent",
    kind: "object",
    isList: true,
    isRequired: true,
    relationName: "LessonStudents",
  } as any),
];

const lessonStudentModel = makeModel("LessonStudent", lessonStudentFields);
const lessonModel = makeModel("Lesson", lessonFields);

describe("ViewsTransformer — Phase 2 transforms", () => {
  beforeEach(() => {
    mockedWriteFileSafely.mockClear();
  });

  it("static map: emits map const before view blocks", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: {
              status: { ACTIVE: "開催中", CANCELLED: "中止" },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStatusMap");
    expect(content).toContain('"ACTIVE":"開催中"');
    expect(content).toContain("as const");
  });

  it("static map: DTO type uses literal union of map values", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: {
              status: { ACTIVE: "開催中", CANCELLED: "中止" },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain('"開催中" | "中止"');
    // original string type should not appear for that field
    expect(content).not.toMatch(/status: string/);
  });

  it("static map: mapper uses map lookup", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: {
              status: { ACTIVE: "開催中", CANCELLED: "中止" },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStatusMap[v.status as keyof typeof _detailStatusMap]");
  });

  it("function transform: emits transform const", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: {
              status: (v: string) => (v === "CANCELLED" ? "中止" : "開催中"),
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStatusTransform");
    expect(content).toContain("中止");
  });

  it("function transform: DTO type uses ReturnType", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: {
              status: (v: string) => (v === "CANCELLED" ? "中止" : "開催中"),
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("ReturnType<typeof _detailStatusTransform>");
  });

  it("function transform: mapper calls transform function", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: {
              status: (v: string) => (v === "CANCELLED" ? "中止" : "開催中"),
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStatusTransform(v.status)");
  });

  it("nested path: static map transforms field inside array relation", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: {
              id: true,
              students: {
                select: { id: true, attendance: true },
              },
            },
            transforms: {
              "students.attendance": { ABSENT: "お休み", SCHEDULED: "予定" },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    // Map const emitted
    expect(content).toContain("_detailStudentsAttendanceMap");
    // DTO type has literal union
    expect(content).toContain('"お休み" | "予定"');
    // Mapper uses map lookup inside .map()
    expect(content).toContain(
      "_detailStudentsAttendanceMap[item.attendance as keyof typeof _detailStudentsAttendanceMap]",
    );
  });

  it("nested path: function transform transforms field inside array relation", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: {
              id: true,
              students: {
                select: { id: true, attendance: true },
              },
            },
            transforms: {
              "students.attendance": (v: string) =>
                v === "ABSENT" ? "お休み" : "予定",
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStudentsAttendanceTransform");
    expect(content).toContain("ReturnType<typeof _detailStudentsAttendanceTransform>");
    expect(content).toContain("_detailStudentsAttendanceTransform(item.attendance)");
  });

  it("untransformed fields alongside transformed fields remain unchanged", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, date: true, status: true },
            transforms: {
              status: { ACTIVE: "開催中", CANCELLED: "中止" },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("id: number");
    expect(content).toContain("date: string");
    expect(content).toContain("v.id");
    expect(content).toContain("v.date");
  });

  it("two views with same path but different transforms get distinct consts", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, status: true },
            transforms: { status: { ACTIVE: "開催中" } },
          },
          listItem: {
            select: { id: true, status: true },
            transforms: { status: { ACTIVE: "active" } },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStatusMap");
    expect(content).toContain("_listItemStatusMap");
  });
});

// ─── Phase 3: computed ───────────────────────────────────────────────────────

describe("ViewsTransformer — Phase 3 computed", () => {
  beforeEach(() => {
    mockedWriteFileSafely.mockClear();
  });

  it("emits computed const before view blocks", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, date: true },
            computed: {
              label: { from: (v: { date: string }) => `lesson-${v.date}` },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailLabelComputed");
    expect(content).toContain("lesson-");
  });

  it("DTO type infers computed field type from from() return", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true },
            computed: {
              startDateTime: { from: (v: { date: string }) => `${v.date}T00:00:00+09:00` },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("startDateTime: ReturnType<typeof _detailStartDateTimeComputed>");
  });

  it("mapper calls computed function with full row", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true },
            computed: {
              startDateTime: { from: (v: { date: string }) => `${v.date}T00:00:00+09:00` },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailStartDateTimeComputed(v)");
  });

  it("select fields and computed fields coexist in DTO and mapper", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true, date: true },
            computed: {
              label: { from: (v: { date: string }) => `lesson-${v.date}` },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("id: number");
    expect(content).toContain("date: string");
    expect(content).toContain("label: ReturnType<typeof _detailLabelComputed>");
    expect(content).toContain("v.id");
    expect(content).toContain("v.date");
    expect(content).toContain("_detailLabelComputed(v)");
  });

  it("two views get distinct computed consts", async () => {
    const vt = new ViewsTransformer({
      models: [lessonModel, lessonStudentModel],
      spec: {
        Lesson: {
          detail: {
            select: { id: true },
            computed: {
              label: { from: (v: { id: number }) => `detail-${v.id}` },
            },
          },
          listItem: {
            select: { id: true },
            computed: {
              label: { from: (v: { id: number }) => `list-${v.id}` },
            },
          },
        },
      },
      outputPath: "/tmp/views",
    });
    await vt.transform();

    const content = findContent("Lesson.views.ts");
    expect(content).toContain("_detailLabelComputed");
    expect(content).toContain("_listItemLabelComputed");
  });
});
