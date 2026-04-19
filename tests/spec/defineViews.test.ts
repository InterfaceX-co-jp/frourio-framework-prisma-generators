import { describe, it, expect } from "vitest";
import { defineViews } from "../../src/spec/defineViews";

describe("defineViews", () => {
  it("returns the spec object unchanged (identity)", () => {
    const spec = {
      User: {
        customer: {
          select: { id: true, name: true },
        },
      },
    };

    const result = defineViews(spec);

    expect(result).toBe(spec);
  });

  it("preserves nested select shape", () => {
    const spec = defineViews({
      Lesson: {
        detail: {
          select: {
            id: true,
            store: { select: { id: true, name: true } },
          },
        },
      },
    });

    expect(spec.Lesson.detail.select).toEqual({
      id: true,
      store: { select: { id: true, name: true } },
    });
  });

  it("allows multiple views per model", () => {
    const spec = defineViews({
      Lesson: {
        detail: { select: { id: true, date: true } },
        listItem: { select: { id: true } },
      },
    });

    expect(Object.keys(spec.Lesson)).toEqual(["detail", "listItem"]);
  });
});
