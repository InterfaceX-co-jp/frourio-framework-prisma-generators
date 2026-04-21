import { describe, it, expect } from "vitest";
import { defineModelDto } from "../../src/spec/defineModelDto";

describe("defineModelDto", () => {
  it("returns ModelDef with _modelName and _views", () => {
    const model = defineModelDto("User", {
      views: {
        profile: { select: { id: true, name: true } },
      },
    });

    expect(model._modelName).toBe("User");
    expect(model._views).toEqual({ profile: { select: { id: true, name: true } } });
  });

  it("defaults _views to empty object when views omitted", () => {
    const model = defineModelDto("User", {});
    expect(model._views).toEqual({});
  });

  it("preserves multiple views", () => {
    const model = defineModelDto("Post", {
      views: {
        detail: { select: { id: true, title: true } },
        listItem: { select: { id: true } },
      },
    });

    expect(Object.keys(model._views)).toEqual(["detail", "listItem"]);
  });
});
