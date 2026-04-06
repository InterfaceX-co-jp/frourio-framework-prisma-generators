/**
 * Basic Builder Usage
 *
 * Builder lets you construct models without passing all relation fields.
 * List relations default to [], optional relations to undefined.
 */
import { PrismaClient } from "@prisma/client";
import { UserModel } from "../../prisma/__generated__/model/User.model";

const prisma = new PrismaClient();

// ============================================================
// Production: Build from Prisma record, skip unused relations
// ============================================================

async function getUserWithPosts(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  const posts = await prisma.post.findMany({
    where: { authorId: userId },
  });

  // Only set the relations you actually loaded.
  // books, initiatorUserNotification, receivingUserNotification → []
  return UserModel.builder()
    .fromPrisma(user)
    .posts(posts)
    .build();
}

// Compare with fromPrismaValue — all relations are required:
//
// UserModel.fromPrismaValue({
//   self: user,
//   posts: posts,
//   books: [],                         // must pass even if unused
//   initiatorUserNotification: [],      // must pass even if unused
//   receivingUserNotification: [],      // must pass even if unused
// });
