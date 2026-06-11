import { describe, it, expect } from "vitest";
import { normalizeFieldName } from "../src/generators/utils/normalizeFieldName";

describe("normalizeFieldName", () => {
  it("converts snake_case to camelCase", () => {
    expect(normalizeFieldName("external_id")).toBe("externalId");
    expect(normalizeFieldName("internal_code")).toBe("internalCode");
    expect(normalizeFieldName("phone_number")).toBe("phoneNumber");
    expect(normalizeFieldName("bank_info")).toBe("bankInfo");
  });

  it("leaves camelCase names unchanged", () => {
    expect(normalizeFieldName("externalId")).toBe("externalId");
    expect(normalizeFieldName("phoneNumber")).toBe("phoneNumber");
    expect(normalizeFieldName("id")).toBe("id");
  });
});
