/**
 * @dto(nested: true) — Nested DTO Conversion
 *
 * Relation fields annotated with @dto(nested: true) are automatically
 * converted to their model's DTO form in toDto() output.
 * Without this annotation, relations are passed through as raw
 * Prisma WithIncludes types.
 *
 * Schema:
 *   model User {
 *     id    Int    @id
 *     email String
 *     posts Post[] /// @dto(nested: true)
 *     books Book[]
 *   }
 */
import { PrismaClient } from "@prisma/client";
import { UserModel } from "../../prisma/__generated__/model/User.model";

const prisma = new PrismaClient();

async function getUserWithNestedDtos(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  const posts = await prisma.post.findMany({
    where: { authorId: userId },
  });

  const model = UserModel.builder()
    .fromPrisma(user)
    .posts(posts)
    .build();

  const dto = model.toDto();

  // posts → PostModelDto[] (automatically converted via builder + toDto)
  // Because posts has @dto(nested: true), each post is converted to its DTO form.
  // DateTime fields like createdAt become ISO strings, BigInt becomes string, etc.
  console.log(dto.posts);
  // → [{ id: 1, createdAt: "2024-01-01T00:00:00.000Z", title: "...", ... }]

  // books → BookWithIncludes[] (raw Prisma type, no @dto(nested: true))
  console.log(dto.books);
  // → raw Prisma objects as-is

  return dto;
}
