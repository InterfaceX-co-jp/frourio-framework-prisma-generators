import { describe, it, expect } from "vitest";
import { normalizeFieldName } from "../src/generators/utils/normalizeFieldName";

describe("normalizeFieldName", () => {
  it("converts snake_case to camelCase", () => {
    expect(normalizeFieldName("myfans_id")).toBe("myfansId");
    expect(normalizeFieldName("avple_id")).toBe("avpleId");
    expect(normalizeFieldName("phone_number")).toBe("phoneNumber");
    expect(normalizeFieldName("bank_info")).toBe("bankInfo");
  });

  it("leaves camelCase names unchanged", () => {
    expect(normalizeFieldName("myfansId")).toBe("myfansId");
    expect(normalizeFieldName("phoneNumber")).toBe("phoneNumber");
    expect(normalizeFieldName("id")).toBe("id");
  });
});
