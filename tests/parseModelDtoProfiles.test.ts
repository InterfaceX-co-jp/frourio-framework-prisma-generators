import { describe, it, expect } from "vitest";
import { parseModelDtoProfiles } from "../src/generators/model/lib/dto/parseModelDtoProfiles";

const makeModel = (documentation?: string) =>
  ({
    name: "User",
    dbName: null,
    fields: [
      { name: "id", kind: "scalar", type: "Int", isRequired: true, isList: false, isUnique: false, isId: true, isReadOnly: false, hasDefaultValue: true, isGenerated: false, isUpdatedAt: false },
      { name: "email", kind: "scalar", type: "String", isRequired: true, isList: false, isUnique: true, isId: false, isReadOnly: false, hasDefaultValue: false, isGenerated: false, isUpdatedAt: false },
      { name: "name", kind: "scalar", type: "String", isRequired: false, isList: false, isUnique: false, isId: false, isReadOnly: false, hasDefaultValue: false, isGenerated: false, isUpdatedAt: false },
    ],
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    isGenerated: false,
    documentation,
  }) as any;

describe("parseModelDtoProfiles", () => {
  it("returns empty array when no documentation", () => {
    expect(parseModelDtoProfiles({ model: makeModel() })).toEqual([]);
  });

  it("parses a single pick profile", () => {
    const profiles = parseModelDtoProfiles({
      model: makeModel("@dto.profile(name: Public, pick: [id, email])"),
    });
    expect(profiles).toEqual([
      { name: "Public", pick: ["id", "email"] },
    ]);
  });

  it("parses a single omit profile", () => {
    const profiles = parseModelDtoProfiles({
      model: makeModel("@dto.profile(name: Admin, omit: [password])"),
    });
    expect(profiles).toEqual([
      { name: "Admin", omit: ["password"] },
    ]);
  });

  it("parses multiple profiles", () => {
    const doc =
      "@dto.profile(name: Public, pick: [id, email])\n@dto.profile(name: Admin, omit: [password])";
    const profiles = parseModelDtoProfiles({ model: makeModel(doc) });
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe("Public");
    expect(profiles[1].name).toBe("Admin");
  });

  it("skips duplicate profile names", () => {
    const doc =
      "@dto.profile(name: Public, pick: [id])\n@dto.profile(name: Public, pick: [email])";
    const profiles = parseModelDtoProfiles({ model: makeModel(doc) });
    expect(profiles).toHaveLength(1);
  });

  it("skips profiles with empty field lists", () => {
    const profiles = parseModelDtoProfiles({
      model: makeModel("@dto.profile(name: Empty, pick: [])"),
    });
    expect(profiles).toEqual([]);
  });
});
