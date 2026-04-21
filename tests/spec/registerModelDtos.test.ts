import { describe, it, expect } from "vitest";
import { defineModelDto } from "../../src/spec/defineModelDto";
import { registerModelDtos } from "../../src/spec/registerModelDtos";

describe("registerModelDtos", () => {
  it("merges ModelDefs into a LoadedSpec", () => {
    const spec = registerModelDtos([
      defineModelDto("User", { views: { profile: { select: { id: true } } } }),
      defineModelDto("Post", { views: { detail: { select: { id: true, title: true } } } }),
    ]);

    expect(spec._type).toBe("LoadedSpec");
    expect(spec.views).toEqual({
      User: { profile: { select: { id: true } } },
      Post: { detail: { select: { id: true, title: true } } },
    });
    expect(spec.base).toEqual({});
  });

  it("includes base config when provided", () => {
    const spec = registerModelDtos([
      defineModelDto("User", {
        views: { profile: { select: { id: true } } },
        base: {
          fields: { password: { hide: true } },
          profiles: [{ name: "Public", pick: ["id", "email"] }],
        },
      }),
    ]);

    expect(spec.base).toEqual({
      User: {
        fields: { password: { hide: true } },
        profiles: [{ name: "Public", pick: ["id", "email"] }],
      },
    });
  });

  it("handles empty array", () => {
    const spec = registerModelDtos([]);
    expect(spec._type).toBe("LoadedSpec");
    expect(spec.views).toEqual({});
    expect(spec.base).toEqual({});
  });

  it("throws on duplicate model names", () => {
    expect(() =>
      registerModelDtos([
        defineModelDto("User", { views: { a: { select: { id: true } } } }),
        defineModelDto("User", { views: { b: { select: { name: true } } } }),
      ]),
    ).toThrow(/duplicate model "User"/);
  });
});
