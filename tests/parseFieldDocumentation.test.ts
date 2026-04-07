import { describe, it, expect } from "vitest";
import { parseFieldDocumentation } from "../src/generators/model/lib/json/parseFieldDocumentation";

const makeField = (overrides: Record<string, any> = {}) =>
  ({
    name: "data",
    kind: "scalar",
    isList: false,
    isRequired: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    type: "Json",
    hasDefaultValue: false,
    isGenerated: false,
    isUpdatedAt: false,
    ...overrides,
  }) as any;

describe("parseFieldDocumentation", () => {
  it("returns undefined when no documentation", () => {
    const result = parseFieldDocumentation({
      field: makeField({ documentation: undefined }),
    });
    expect(result).toBeUndefined();
  });

  it("parses @json(type: [T]) annotation", () => {
    const result = parseFieldDocumentation({
      field: makeField({ documentation: "@json(type: [JsonObject])" }),
    });
    expect(result).toEqual({
      type: { jsonType: "JsonObject", hasJsonType: true },
    });
  });

  it("parses @json(type: [T]) with different type name", () => {
    const result = parseFieldDocumentation({
      field: makeField({ documentation: "@json(type: [MyCustomType])" }),
    });
    expect(result?.type?.jsonType).toBe("MyCustomType");
  });

  it("returns undefined jsonType when documentation has no @json annotation", () => {
    const result = parseFieldDocumentation({
      field: makeField({ documentation: "some random comment" }),
    });
    expect(result?.type?.jsonType).toBeUndefined();
    expect(result?.type?.hasJsonType).toBe(false);
  });
});
