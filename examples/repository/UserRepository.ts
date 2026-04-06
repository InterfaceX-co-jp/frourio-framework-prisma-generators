/**
 * Repository Pattern Example
 *
 * A typical repository using fromPrismaValue for strict typing
 * and builder for flexible partial queries.
 */
import { PrismaClient } from "@prisma/client";
import { UserModel } from "../../prisma/__generated__/model/User.model";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Full load — use fromPrismaValue (strict, all relations required)
   */
  async findByIdWithAllRelations(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;

    const [posts, books, initiatorNotifs, receivingNotifs] = await Promise.all([
      this.prisma.post.findMany({ where: { authorId: userId } }),
      this.prisma.book.findMany({ where: { authorId: userId } }),
      this.prisma.userNotification.findMany({
        where: { initiatorUserId: userId },
      }),
      this.prisma.userNotification.findMany({
        where: { receivingUserId: userId },
      }),
    ]);

    return UserModel.fromPrismaValue({
      self: user,
      posts,
      books,
      initiatorUserNotification: initiatorNotifs,
      receivingUserNotification: receivingNotifs,
    });
  }

  /**
   * Partial load — use builder (flexible, skip unused relations)
   */
  async findById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;

    // No relations loaded — all default to []
    return UserModel.builder().fromPrisma(user).build();
  }

  /**
   * Partial load with specific relations
   */
  async findByIdWithPosts(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;

    const posts = await this.prisma.post.findMany({
      where: { authorId: userId },
    });

    return UserModel.builder()
      .fromPrisma(user)
      .posts(posts)
      .build();
  }
}
