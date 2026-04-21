/**
 * Computed fields
 *
 * A view's `computed` block adds derived fields to the DTO that are not
 * part of the Prisma `select`. The `from(row)` function runs per row; its
 * return type is declared via `type`.
 *
 * spec snippet (see `prisma/dto.spec.ts`):
 *
 *   Post: {
 *     detail: {
 *       select: { id: true, title: true, published: true, ... },
 *       computed: {
 *         summary: {
 *           from: (v) => `${v.title} (${v.published ? "公開" : "非公開"})`,
 *         },
 *       },
 *     },
 *   }
 *
 * The DTO's `summary` type is inferred from `from`'s return type. Computed
 * fields run inside the view class's `toDto()` — callers just read the result.
 */
import { PrismaClient } from "@prisma/client";
import {
  postDetailSelect,
  PostDetailView,
} from "../../prisma/__generated__/views/Post.views";

async function example() {
  const prisma = new PrismaClient();

  const row = await prisma.post.findUnique({
    where: { id: 1 },
    select: postDetailSelect,
  });
  if (!row) return;

  const post = PostDetailView.fromPrismaValue(row).toDto();
  console.log(post.title);   // raw field
  console.log(post.summary); // computed — e.g. "Hello (公開)"
}
