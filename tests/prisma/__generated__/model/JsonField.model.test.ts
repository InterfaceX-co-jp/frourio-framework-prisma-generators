import { expect, test } from "vitest";
import { JsonFieldModel } from "../../../../prisma/__generated__/model/JsonField.model";

test("toDto()", () => {
  const model = JsonFieldModel.fromPrismaValue({
    self: {
      id: 1,
      rawJson: {
        hoge: "hoge",
      },
      jsonObject: {
        foo: "aaa",
        bar: 1,
      },
      jsonArray: [1, 2, 3],
    },
  });

  const dto = model.toDto();

  expect(dto.id).toBe(model.id);
  expect(dto.rawJson).toBe(model.rawJson);
  expect(dto.jsonObject).toBe(model.jsonObject);
  expect(dto.jsonArray).toBe(model.jsonArray);
});
