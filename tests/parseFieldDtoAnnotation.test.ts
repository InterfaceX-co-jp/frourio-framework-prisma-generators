import { describe, it, expect } from "vitest";
import { parseFieldDtoAnnotation } from "../src/generators/model/lib/dto/parseFieldDtoAnnotation";

const makeField = (overrides: Record<string, any> = {}) =>
  ({
    name: "field",
    kind: "scalar",
    isList: false,
    isRequired: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    type: "String",
    hasDefaultValue: false,
    isGenerated: false,
    isUpdatedAt: false,
    ...overrides,
  }) as any;

describe("parseFieldDtoAnnotation", () => {
  it("returns undefined when no documentation", () => {
    expect(
      parseFieldDtoAnnotation({ field: makeField() }),
    ).toBeUndefined();
  });

  it("returns undefined when documentation has no @dto annotation", () => {
    expect(
      parseFieldDtoAnnotation({
        field: makeField({ documentation: "just a comment" }),
      }),
    ).toBeUndefined();
  });

  it("parses @dto(hidden: true)", () => {
    const result = parseFieldDtoAnnotation({
      field: makeField({ documentation: "@dto(hidden: true)" }),
    });
    expect(result).toEqual({ hidden: true, nested: false });
  });

  it("parses @dto(nested: true)", () => {
    const result = parseFieldDtoAnnotation({
      field: makeField({ documentation: "@dto(nested: true)" }),
    });
    expect(result).toEqual({ hidden: false, nested: true });
  });

  it("returns undefined for @dto(hidden: false)", () => {
    const result = parseFieldDtoAnnotation({
      field: makeField({ documentation: "@dto(hidden: false)" }),
    });
    expect(result).toBeUndefined();
  });
});
