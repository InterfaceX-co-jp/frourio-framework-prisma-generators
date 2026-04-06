/**
 * @json — Custom Typed Json Fields
 *
 * Prisma Json fields are typed as Prisma.JsonValue by default.
 * Use @json(type: [TypeName]) to assign a custom TypeScript type.
 *
 * Schema:
 *   model JsonField {
 *     id         Int  @id
 *     rawJson    Json
 *     jsonObject Json /// @json(type: [JsonObject])
 *     jsonArray  Json /// @json(type: [JsonArray])
 *   }
 *
 * Additional type file (prisma/@additionalType/index.ts):
 *   export type JsonObject = { foo: string; bar: number };
 *   export type JsonArray = JsonObject[];
 */
import { PrismaClient } from "@prisma/client";
import { JsonFieldModel } from "../../prisma/__generated__/model/JsonField.model";

const prisma = new PrismaClient();

async function getJsonField(id: number) {
  const record = await prisma.jsonField.findUniqueOrThrow({
    where: { id },
  });

  const model = JsonFieldModel.fromPrismaValue({ self: record });

  // rawJson → Prisma.JsonValue (no annotation)
  console.log(model.rawJson);

  // jsonObject → JsonObject (custom typed via @json)
  console.log(model.jsonObject.foo); // string — fully typed!
  console.log(model.jsonObject.bar); // number — fully typed!

  // jsonArray → JsonArray (custom typed via @json)
  console.log(model.jsonArray[0].foo); // string

  return model.toDto();
}
