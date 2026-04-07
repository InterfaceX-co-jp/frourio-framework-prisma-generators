/**
 * @dto(hidden: true) — Hide Sensitive Fields
 *
 * Fields annotated with @dto(hidden: true) are excluded from
 * toDto() output and the ModelDto type, but remain accessible
 * via getters and are still stored internally.
 *
 * Schema:
 *   model User {
 *     id       Int    @id
 *     email    String
 *     password String /// @dto(hidden: true)
 *   }
 */
import { UserModel } from "../../prisma/__generated__/model/User.model";

// Build a user with all fields including password
const user = UserModel.builder()
  .id(1)
  .email("user@example.com")
  .name("Alice")
  .password("hashed_secret_password")
  .build();

// toDto() excludes password — safe for API responses
const dto = user.toDto();
console.log(dto);
// → { id: 1, email: "user@example.com", name: "Alice", posts: [], books: [], ... }
// password is NOT in the output

// But you can still access it via getter when needed internally
console.log(user.password); // → "hashed_secret_password"
