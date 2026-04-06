/**
 * Repository Pattern Example
 *
 * The generated UserRepository already includes:
 *   - findById(id)     — from @id
 *   - findByEmail(email) — from @unique
 *   - paginate(args?)   — typed filtering & pagination
 *   - CRUD (findMany, findFirst, create, update, delete, count)
 *
 * Extend it to add custom query logic.
 */
import { PrismaClient } from "@prisma/client";
import { UserRepository as GeneratedUserRepository } from "../../prisma/__generated__/repository/User.repository";
import { UserModel } from "../../prisma/__generated__/model/User.model";

export class UserRepository extends GeneratedUserRepository {
  /**
   * Custom query — search users by partial name match
   */
  async searchByName(name: string): Promise<UserModel[]> {
    return this.findMany({
      where: { name: { contains: name, mode: "insensitive" } },
    });
  }
}

/**
 * Usage example
 */
async function example() {
  const prisma = new PrismaClient();
  const userRepo = new UserRepository(prisma.user);

  // Auto-generated methods
  const user = await userRepo.findById(1);
  const userByEmail = await userRepo.findByEmail("alice@example.com");

  // Paginate with typed filters
  const page = await userRepo.paginate({
    page: 1,
    perPage: 20,
    where: { name: { contains: "alice", mode: "insensitive" } },
    orderBy: { field: "id", direction: "desc" },
  });

  console.log(`Page ${page.page}/${page.totalPages}, total: ${page.total}`);
  console.log(page.data.map((u) => u.toDto()));

  // Custom method
  const alices = await userRepo.searchByName("Alice");
}
