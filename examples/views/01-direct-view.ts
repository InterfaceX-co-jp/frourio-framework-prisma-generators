/**
 * View-driven DTO — direct use
 *
 * Each view in `prisma/dto.spec.ts` generates these exports in
 * `prisma/__generated__/views/<Model>.views.ts`:
 *   - `<model><View>Select` — typed `Prisma.<Model>Select` const
 *   - `<Model><View>Row`    — raw row shape returned by Prisma
 *   - `<Model><View>Dto`    — flattened DTO type
 *   - `<Model><View>View`   — class with `fromPrismaValue(row)` / `toDto()`
 *
 * Mirrors the Model API (`UserModel.fromPrismaValue(row).toDto()`) so the
 * "query → wrap → DTO" pipeline is the same for full models and views.
 */
import { PrismaClient } from "@prisma/client";
import {
  userProfileSelect,
  UserProfileView,
  type UserProfileDto,
} from "../../prisma/__generated__/views/User.views";

const prisma = new PrismaClient();

async function getUserProfile(userId: number): Promise<UserProfileDto | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  });
  if (!row) return null;

  return UserProfileView.fromPrismaValue(row).toDto();
}

async function listUserProfiles(): Promise<UserProfileDto[]> {
  const rows = await prisma.user.findMany({ select: userProfileSelect });
  return rows.map((r) => UserProfileView.fromPrismaValue(r).toDto());
}
