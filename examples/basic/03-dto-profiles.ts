/**
 * @dto.profile — Custom DTO Profiles
 *
 * Generate purpose-specific DTOs with pick or omit.
 *
 * Schema:
 *   /// @dto.profile(name: Public, pick: [id, email, name])
 *   /// @dto.profile(name: Admin, omit: [password])
 *   model User {
 *     id       Int    @id
 *     email    String
 *     name     String?
 *     password String /// @dto(hidden: true)
 *     posts    Post[]
 *   }
 */
import { UserModel, UserPublicDto, UserAdminDto } from "../../prisma/__generated__/model/User.model";

const user = UserModel.builder()
  .id(1)
  .email("user@example.com")
  .name("Alice")
  .password("hashed_password")
  .build();

// ============================================================
// Default toDto() — hidden fields excluded
// ============================================================
const defaultDto = user.toDto();
// → { id, email, name, posts: [], books: [], ... }
// password is excluded by @dto(hidden: true)

// ============================================================
// Public profile — only picked fields
// ============================================================
const publicDto: UserPublicDto = user.toPublicDto();
console.log(publicDto);
// → { id: 1, email: "user@example.com", name: "Alice" }
// Only id, email, name — no relations, no password

// ============================================================
// Admin profile — everything except omitted fields
// ============================================================
const adminDto: UserAdminDto = user.toAdminDto();
console.log(adminDto);
// → { id: 1, email: "user@example.com", name: "Alice", posts: [], books: [], ... }
// All fields except password
