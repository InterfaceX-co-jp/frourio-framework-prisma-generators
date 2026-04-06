/**
 * Basic Model Usage — fromPrismaValue and toDto
 *
 * The most common pattern: query with Prisma Client,
 * convert to a model instance, then output as DTO.
 */
import { PrismaClient } from "@prisma/client";
import { PostModel } from "../../prisma/__generated__/model/Post.model";
import { UserModel } from "../../prisma/__generated__/model/User.model";

const prisma = new PrismaClient();

// ============================================================
// Simple model without relations
// ============================================================

async function getPost(postId: number) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: {
      author: true,
      Polymorphic: true,
      Book_Post: true,
    },
  });

  // fromPrismaValue requires all relations to be passed explicitly
  const model = PostModel.fromPrismaValue({
    self: post,
    author: post.author ?? undefined,
    polymorphic: post.Polymorphic,
    bookPost: post.Book_Post,
  });

  // Access fields via getters
  console.log(model.id);        // number
  console.log(model.createdAt); // Date object
  console.log(model.title);     // string

  // Convert to DTO — DateTime becomes ISO string
  const dto = model.toDto();
  console.log(dto.createdAt);   // "2024-01-01T00:00:00.000Z"

  return dto;
}

// ============================================================
// Model with all relations
// ============================================================

async function getUserWithAllRelations(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  const [posts, books, initiatorNotifs, receivingNotifs] = await Promise.all([
    prisma.post.findMany({ where: { authorId: userId } }),
    prisma.book.findMany({ where: { authorId: userId } }),
    prisma.userNotification.findMany({ where: { initiatorUserId: userId } }),
    prisma.userNotification.findMany({ where: { receivingUserId: userId } }),
  ]);

  // fromPrismaValue is strict — all relations are required
  return UserModel.fromPrismaValue({
    self: user,
    posts,
    books,
    initiatorUserNotification: initiatorNotifs,
    receivingUserNotification: receivingNotifs,
  });
}
