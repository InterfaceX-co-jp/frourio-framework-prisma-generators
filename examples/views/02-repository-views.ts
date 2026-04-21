/**
 * Repository view methods
 *
 * When the `repository` generator receives the same `spec` option as the
 * `model` generator, each view defined in `dto.spec.ts` produces three
 * repository methods:
 *   - `findById<View>(id)` — findUnique + mapper
 *   - `findMany<View>(args?)` — findMany + mapper
 *   - `paginate<View>(args?)` — page/perPage pagination + mapper
 *
 * Use these instead of hand-writing `select` + mapper in call sites.
 */
import { PrismaClient } from "@prisma/client";
import { UserRepository } from "../../prisma/__generated__/repository/User.repository";

async function example() {
  const prisma = new PrismaClient();
  const userRepo = new UserRepository(prisma.user);

  // Auto-generated `profile` view methods
  const profile = await userRepo.findByIdProfile(1);
  //    ^? UserProfileDto | null

  const profiles = await userRepo.findManyProfile({
    where: { name: { contains: "alice", mode: "insensitive" } },
    orderBy: { field: "id", direction: "desc" },
  });

  const paged = await userRepo.paginateProfile({
    page: 1,
    perPage: 20,
    orderBy: { field: "id", direction: "desc" },
  });
  console.log(`page ${paged.page}/${paged.totalPages}, total ${paged.total}`);

  // `listItem` view — lightweight shape for lists
  const items = await userRepo.findManyListItem();
  //    ^? UserListItemDto[]
}
