/**
 * Test Fixture with Builder
 *
 * Use individual scalar setters with Faker (or any test data library)
 * to create model instances for tests.
 * Relations default to [] so you only specify what the test needs.
 */
import { UserModel } from "../../prisma/__generated__/model/User.model";

// ============================================================
// Simple fixture — minimal required fields
// ============================================================

function createUserFixture(overrides?: {
  id?: number;
  email?: string;
  name?: string | null;
  password?: string;
}) {
  return UserModel.builder()
    .id(overrides?.id ?? 1)
    .email(overrides?.email ?? "test@example.com")
    .name(overrides?.name ?? "Test User")
    .password(overrides?.password ?? "hashed_password")
    .build();
}

// Usage in tests:
const user1 = createUserFixture();
const user2 = createUserFixture({ email: "admin@example.com", name: "Admin" });

// ============================================================
// With Faker
// ============================================================

// import { faker } from "@faker-js/faker";
//
// function createRandomUser() {
//   return UserModel.builder()
//     .id(faker.number.int())
//     .email(faker.internet.email())
//     .name(faker.person.fullName())
//     .password(faker.internet.password())
//     .build();
// }
