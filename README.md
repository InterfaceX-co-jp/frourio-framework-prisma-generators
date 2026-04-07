# frourio-framework-prisma-generators

A Prisma generator that produces immutable, type-safe TypeScript model classes from your Prisma schema.

## Features

- Generates immutable TypeScript model classes from Prisma schema
- `toDto()` method for DTO conversion (DateTime to ISO string, Decimal to number, etc.)
- `fromPrismaValue()` for bridging from Prisma Client results
- **Builder pattern** for flexible construction, model extension, and test fixtures
- Custom typing for `Json` fields (`@json` annotation)
- Field hiding from DTO output (`@dto(hidden: true)` annotation)
- Custom DTO profiles with pick/omit (`@dto.profile` annotation)
- Auto-generated relation types (`WithIncludes`)
- Automatic foreign key field exclusion when a relation field exists
- **Repository generation** (beta) — auto-generated repository classes with `findBy`, `paginate`, and CRUD

## Requirements

- prisma, @prisma/client@7.2.0 or later **(both must be the same version!)**

## Install

```bash
npm install -D frourio-framework-prisma-generators
```

## Setup

Add the generator configuration to your `schema.prisma`:

```prisma
generator frourio_framework_prisma_model_generator {
    provider = "frourio-framework-prisma-model-generator"
    output   = "__generated__/models"
    additionalTypePath = "./@additionalType/index" // Required when using @json annotation
}
```

| Option | Description |
|--------|-------------|
| `provider` | Generator name (fixed value) |
| `output` | Output directory (relative to prisma schema) |
| `additionalTypePath` | Import path for custom types used with `@json` annotation |

### Repository Generator (Beta)

Add a separate generator block to enable auto-generated repository classes:

```prisma
generator repository {
    provider  = "frourio-framework-prisma-repository-generator"
    output    = "__generated__/repository"
    modelPath = "__generated__/model"    // Path to model generator output
}
```

| Option | Description |
|--------|-------------|
| `provider` | Generator name (fixed value) |
| `output` | Output directory (relative to prisma schema) |
| `modelPath` | Path to model generator output (for import resolution) |

---

## Examples

Working examples are available in the [`examples/`](examples/) directory:

### Basic Usage

| File | Description |
|------|-------------|
| [`basic/01-from-prisma-value.ts`](examples/basic/01-from-prisma-value.ts) | `fromPrismaValue` and `toDto` — query, convert, and output |
| [`basic/02-dto-hidden.ts`](examples/basic/02-dto-hidden.ts) | `@dto(hidden: true)` — hide sensitive fields like `password` |
| [`basic/03-dto-profiles.ts`](examples/basic/03-dto-profiles.ts) | `@dto.profile` — purpose-specific DTOs with pick/omit |
| [`basic/04-json-typed-fields.ts`](examples/basic/04-json-typed-fields.ts) | `@json` — custom TypeScript types for Json fields |
| [`basic/05-dto-nested.ts`](examples/basic/05-dto-nested.ts) | `@dto(nested: true)` — auto-convert relations to nested DTOs |

### Builder Pattern

| File | Description |
|------|-------------|
| [`builder/01-basic-builder.ts`](examples/builder/01-basic-builder.ts) | Skip unused relations with the builder |
| [`builder/02-test-fixture.ts`](examples/builder/02-test-fixture.ts) | Test fixtures with Faker |
| [`builder/03-extend-model.ts`](examples/builder/03-extend-model.ts) | Custom fields, builder extension, DTO customization |

### Repository Pattern (Beta)

| File | Description |
|------|-------------|
| [`repository/UserRepository.ts`](examples/repository/UserRepository.ts) | Extending the generated repository with custom queries |
| [`repository/JsonField.repository.ts`](examples/repository/JsonField.repository.ts) | Simple repository usage without the generator |

> **Note:** Repository generation is a beta feature. Add a separate `repository` generator block to enable it.

---

## Repository Generator (Beta)

When the repository generator is enabled, it produces:

- **`BaseRepository`** — abstract class with CRUD operations and pagination
- **`{Model}Repository`** — concrete class per model with auto-generated query methods

### Auto-Generated Methods

For each model, the following methods are generated based on schema metadata:

| Source | Generated Method | Example |
|--------|-----------------|---------|
| `@id` field | `findBy{Field}(value)` | `findById(id: number)` |
| `@unique` field | `findBy{Field}(value)` | `findByEmail(email: string)` |
| `@@unique([x, y])` | `findBy{X}And{Y}(x, y)` | `findByBookIdAndPostId(bookId, postId)` |
| All models | `paginate(args?)` | Typed filtering, sorting, and pagination |

### Inherited Methods (from BaseRepository)

| Method | Description |
|--------|-------------|
| `findMany(args?)` | Find all matching records |
| `findFirst(args?)` | Find the first matching record |
| `count(args?)` | Count matching records |
| `exists(where)` | Check if a matching record exists |
| `create(args)` | Create a record and return the model |
| `createMany(args)` | Batch create records (returns count) |
| `update(args)` | Update a record and return the model |
| `updateMany(args)` | Batch update records (returns count) |
| `upsert(args)` | Create or update a record |
| `delete(args)` | Delete a record and return the model |
| `deleteMany(args?)` | Batch delete records (returns count) |
| `aggregate(args)` | Aggregate operations (count, sum, avg, min, max) |
| `cursorPaginate(args)` | Cursor-based pagination for large datasets |
| `withTransaction(tx)` | Create a repository instance bound to a transaction |

### Usage — Direct

```ts
import { PrismaClient } from "@prisma/client";
import { UserRepository } from "./__generated__/repository/User.repository";

const prisma = new PrismaClient();
const userRepo = new UserRepository(prisma.user);

// Auto-generated findBy methods
const user = await userRepo.findById(1);
const userByEmail = await userRepo.findByEmail("alice@example.com");

// Paginate with typed filters
const page = await userRepo.paginate({
  page: 1,
  perPage: 20,
  where: { name: { contains: "alice", mode: "insensitive" } },
  orderBy: { field: "id", direction: "desc" },
});
```

### Usage — Extending with Custom Methods

```ts
import { PrismaClient } from "@prisma/client";
import { UserRepository as GeneratedUserRepository } from "./__generated__/repository/User.repository";

export class UserRepository extends GeneratedUserRepository {
  // Add custom query methods
  async findActiveUsers() {
    return this.findMany({ where: { active: true } });
  }
}
```

---

## Generated Model Structure

For each Prisma model, the following are generated:

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  title     String
  content   String?
  author    User?    @relation(fields: [authorId], references: [id])
  authorId  Int?
}
```

### DTO Type (`{Model}ModelDto`)

The return type of `toDto()`. `DateTime` is converted to `string`. Foreign key fields (e.g. `authorId`) are automatically excluded when a corresponding relation field exists.

```ts
export type PostModelDto = {
  id: number;
  createdAt: string;    // DateTime → string (ISO 8601)
  title: string;
  content?: string | null;
  author?: UserWithIncludes | null;
};
```

### Constructor Args Type (`{Model}ModelConstructorArgs`)

The constructor argument type. `DateTime` remains as the `Date` type.

```ts
export type PostModelConstructorArgs = {
  id: number;
  createdAt: Date;      // DateTime → Date
  title: string;
  content?: string | null;
  author?: UserWithIncludes | null;
};
```

### FromPrismaValue Args Type (`{Model}ModelFromPrismaValueArgs`)

The argument type for `fromPrismaValue()`. Pass the Prisma record as `self` and relations as separate arguments.

```ts
export type PostModelFromPrismaValueArgs = {
  self: PrismaPost;
  author?: UserWithIncludes;
};
```

### Model Class (`{Model}Model`)

An immutable model class. All fields are stored as `private readonly` and accessed via getters.

```ts
export class PostModel {
  private readonly _id: number;
  private readonly _createdAt: Date;
  private readonly _title: string;
  private readonly _content?: string | null;
  private readonly _author?: UserWithIncludes | null;

  constructor(args: PostModelConstructorArgs) { ... }

  static fromPrismaValue(args: PostModelFromPrismaValueArgs) {
    return new PostModel({
      id: args.self.id,
      createdAt: args.self.createdAt,
      title: args.self.title,
      content: args.self.content,
      author: args.author,
    });
  }

  toDto() {
    return {
      id: this._id,
      createdAt: this._createdAt.toISOString(),
      title: this._title,
      content: this._content,
      author: this._author,
    };
  }

  get id() { return this._id; }
  get createdAt() { return this._createdAt; }
  get title() { return this._title; }
  get content() { return this._content; }
  get author() { return this._author; }
}
```

### Relation Type (`{Model}WithIncludes`)

A `WithIncludes` type is generated for models referenced by relation fields. It includes the related model's relation fields as optional properties.

```ts
export type UserWithIncludes = PartialBy<
  Prisma.UserGetPayload<typeof includeUser>,
  keyof (typeof includeUser)['include']
>;
```

---

## Type Mapping

Conversion rules from Prisma types to TypeScript types:

| Prisma Type | Constructor / Getter | DTO (`toDto()`) | Conversion |
|-------------|---------------------|-----------------|------------|
| `String` | `string` | `string` | None |
| `Int` | `number` | `number` | None |
| `Float` | `number` | `number` | None |
| `Boolean` | `boolean` | `boolean` | None |
| `DateTime` | `Date` | `string` | `.toISOString()` |
| `Json` | `Prisma.JsonValue` | `Prisma.JsonValue` | None (overridable via `@json`) |
| `Decimal` | `number` | `number` | `.toNumber()` in `fromPrismaValue` |
| `BigInt` | `bigint` | `string` | `.toString()` |
| `Bytes` | `Buffer` | `string` | `Buffer.from().toString('base64')` |
| Enum | `Prisma{EnumName}` | `Prisma{EnumName}` | None |
| Relation | `{Type}WithIncludes` | `{Type}WithIncludes` | None |

Nullable fields use `?` with `| null` typing. In `toDto()`, they are safely converted using optional chaining (`?.`) and nullish coalescing (`?? null`).

---

## Annotations

An annotation system using Prisma's `///` documentation comments.

### `@json` - Custom Typing for Json Fields

Assign a custom TypeScript type to `Json` fields.

#### Syntax

```prisma
fieldName Json /// @json(type: [TypeName])
```

#### Configuration

Set the `additionalTypePath` to the import path of your custom types:

```prisma
generator frourio_framework_prisma_model_generator {
    provider           = "frourio-framework-prisma-model-generator"
    output             = "__generated__/models"
    additionalTypePath = "./@additionalType/index"
}
```

#### Example

**1. Add annotations to your schema:**

```prisma
model JsonField {
  id         Int  @id @default(autoincrement())
  rawJson    Json
  jsonObject Json /// @json(type: [JsonObject])
  jsonArray  Json /// @json(type: [JsonArray])
}
```

**2. Define your custom types:**

```ts
// prisma/@additionalType/index.ts
export type JsonObject = {
  foo: string;
  bar: number;
};

export type JsonArray = JsonObject[];
```

**3. Generated output:**

```ts
import { JsonObject, JsonArray } from '../../@additionalType/index';

export type JsonFieldModelDto = {
  id: number;
  rawJson: Prisma.JsonValue;   // No annotation → Prisma.JsonValue
  jsonObject: JsonObject;       // @json → custom type
  jsonArray: JsonArray;         // @json → custom type
};
```

In `fromPrismaValue()`, the value is cast via `as unknown as JsonObject`.

---

### `@dto(hidden: true)` - Hide Fields from DTO

Exclude specific fields from the `toDto()` output and the `{Model}ModelDto` type. Useful for sensitive fields like `password` that should not appear in API responses.

#### Syntax

```prisma
fieldName Type /// @dto(hidden: true)
```

#### Example

```prisma
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  name     String?
  password String /// @dto(hidden: true)
}
```

#### Generated Output

```ts
// DTO type — password is excluded
export type UserModelDto = {
  id: number;
  email: string;
  name?: string | null;
  // password is not included here
};

export class UserModel {
  private readonly _password: string;  // Still stored internally

  toDto() {
    return {
      id: this._id,
      email: this._email,
      name: this._name,
      // password is not output
    };
  }

  get password() { return this._password; }  // Still accessible via getter
}
```

#### Behavior

| Target | Effect of `hidden` |
|--------|-------------------|
| `{Model}ModelDto` type | Excluded |
| `toDto()` method | Excluded |
| `{Model}ModelConstructorArgs` type | **Not affected** (included) |
| `fromPrismaValue()` | **Not affected** (included) |
| Private fields | **Not affected** (retained) |
| Getters | **Not affected** (accessible) |

---

### `@dto(nested: true)` - Nested DTO Conversion

Automatically convert relation fields into their model's DTO form in `toDto()` output. Without this annotation, relation fields are passed through as raw Prisma `WithIncludes` types.

#### Syntax

```prisma
fieldName Model[] /// @dto(nested: true)
```

#### Example

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String
  posts Post[] /// @dto(nested: true)
  books Book[]
}
```

#### Generated Output

```ts
// DTO type — posts uses PostModelDto instead of PostWithIncludes
export type UserModelDto = {
  id: number;
  email: string;
  posts: PostModelDto[];        // @dto(nested: true) → nested DTO
  books: BookWithIncludes[];    // no annotation → raw Prisma type
};

export class UserModel {
  toDto() {
    return {
      id: this._id,
      email: this._email,
      // posts are automatically converted via builder + toDto
      posts: this._posts.map((el) =>
        PostModel.builder().fromPrisma(el).build().toDto()
      ),
      books: this._books,
    };
  }
}
```

#### Behavior

| Target | Effect of `nested` |
|--------|-------------------|
| `{Model}ModelDto` type | Relation type becomes `{Related}ModelDto` |
| `toDto()` method | Automatically converts via `builder().fromPrisma().build().toDto()` |
| `{Model}ModelConstructorArgs` type | **Not affected** (uses `WithIncludes`) |
| `fromPrismaValue()` | **Not affected** (uses `WithIncludes`) |

---

### `@dto.profile` - Custom DTO Profiles

Generate purpose-specific DTO types and methods. Control field inclusion with `pick` (include only specified fields) or `omit` (exclude specified fields).

#### Syntax

Write `///` comments above the model declaration:

```prisma
/// @dto.profile(name: ProfileName, pick: [field1, field2, ...])
/// @dto.profile(name: ProfileName, omit: [field1, field2, ...])
model ModelName {
  ...
}
```

- `name`: Profile name (PascalCase recommended). Used for method and type names.
- `pick`: List of field names to include (mutually exclusive with `omit`).
- `omit`: List of field names to exclude (mutually exclusive with `pick`).

#### Example

```prisma
/// @dto.profile(name: Public, pick: [id, email, name])
/// @dto.profile(name: Admin, omit: [password])
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  name     String?
  password String /// @dto(hidden: true)

  posts Post[]
}
```

#### Generated Output

```ts
// Default DTO — password excluded by @dto(hidden: true)
export type UserModelDto = {
  id: number;
  email: string;
  name?: string | null;
  posts: PostWithIncludes[];
};

// Public profile — only the 3 fields specified by pick
export type UserPublicDto = {
  id: number;
  email: string;
  name?: string | null;
};

// Admin profile — all fields except password (including relations)
export type UserAdminDto = {
  id: number;
  email: string;
  name?: string | null;
  posts: PostWithIncludes[];
};

export class UserModel {
  // Default DTO
  toDto(): UserModelDto { ... }

  // Profile DTOs
  toPublicDto(): UserPublicDto { ... }
  toAdminDto(): UserAdminDto { ... }
}
```

#### Profiles and Hidden Fields

Profiles **override** `@dto(hidden: true)`. If a profile explicitly picks a hidden field, it will be included in that profile's output.

```prisma
/// @dto.profile(name: Debug, pick: [id, password])
model User {
  id       Int    @id
  password String /// @dto(hidden: true)
}
```

In this case:
- `toDto()` — `password` is **excluded** (hidden applies)
- `toDebugDto()` — `password` is **included** (profile overrides hidden)

#### Validation

- Using both `pick` and `omit` on the same profile causes the profile to be ignored
- Referencing a non-existent field name logs a warning and skips that field
- Duplicate profile names on the same model use only the first definition
- An empty `pick` / `omit` list causes the profile to be skipped

---

## Combining Annotations

Multiple annotations can be specified on the same field:

```prisma
model Config {
  id       Int  @id
  settings Json /// @json(type: [SettingsObject]) @dto(hidden: true)
}
```

In this case:
- `settings` is stored internally as the `SettingsObject` type
- Excluded from `toDto()` and `ConfigModelDto`
- Accessible via getter (`config.settings`) as the `SettingsObject` type

---

## Builder Pattern

Each model generates a `{Model}ModelBuilder` class with a fluent API. The builder provides:

- **Optional relations** — skip relations you don't need (list relations default to `[]`)
- **Individual scalar setters** — perfect for test fixtures with Faker
- **Extensibility** — subclass the builder to add custom fields

> **Note:** `fromPrismaValue()` remains strict — all relations are required. The builder is a separate, opt-in flexible path.

### Basic Usage — Skip Unused Relations

```ts
// Before (fromPrismaValue — all relations required):
const user = UserModel.fromPrismaValue({
  self: prismaUser,
  posts: loadedPosts,
  books: [],                         // must pass even if unused
  initiatorUserNotification: [],      // must pass even if unused
  receivingUserNotification: [],      // must pass even if unused
});

// After (builder — only set what you need):
const user = UserModel.builder()
  .fromPrisma(prismaUser)            // sets all scalar fields
  .posts(loadedPosts)                // only the relation you loaded
  .build();                          // books, notifications → []
```

### Test Fixtures with Faker

Individual scalar setters make the builder ideal for test data generation:

```ts
import { faker } from "@faker-js/faker";

function createUserFixture(overrides?: Partial<{
  id: number;
  email: string;
  name: string | null;
  password: string;
}>) {
  return UserModel.builder()
    .id(overrides?.id ?? faker.number.int())
    .email(overrides?.email ?? faker.internet.email())
    .name(overrides?.name ?? faker.person.fullName())
    .password(overrides?.password ?? faker.internet.password())
    .build();
  // All relations default to [] — only specify scalars
}

// In tests:
const user = createUserFixture();
const admin = createUserFixture({ email: "admin@example.com" });
```

### Extending Models — Custom Fields

Subclass the generated model and builder to add custom fields:

```ts
import {
  UserModel,
  UserModelBuilder,
  UserModelConstructorArgs,
} from "./__generated__/model/User.model";

// 1. Extend the model
type AppUserArgs = UserModelConstructorArgs & { fullName: string };

class AppUser extends UserModel {
  private readonly _fullName: string;

  constructor(args: AppUserArgs) {
    super(args);
    this._fullName = args.fullName;
  }

  get fullName() { return this._fullName; }

  override toDto() {
    return { ...super.toDto(), fullName: this._fullName };
  }
}

// 2. Extend the builder
class AppUserBuilder extends UserModelBuilder {
  private _fullName?: string;

  fullName(value: string): this {
    this._fullName = value;
    return this;
  }

  override build(): AppUser {
    if (!this._fullName) throw new Error('"fullName" is required');
    return new AppUser({
      ...this.buildArgs(),   // protected — accessible from subclasses
      fullName: this._fullName,
    });
  }
}

// Usage:
const appUser = new AppUserBuilder()
  .fromPrisma(prismaUser)
  .fullName("John Doe")
  .posts(loadedPosts)
  .build();

appUser.toDto();
// → { id, email, name, posts, ..., fullName }
```

### Extending Models — Custom DTO Output

Override `toDto()` to transform nested relations into rich DTOs:

```ts
class UserWithNestedDtos extends UserModel {
  override toDto() {
    return {
      ...super.toDto(),
      posts: this.posts.map((post) =>
        PostModel.builder().fromPrisma(post).build().toDto()
      ),
    };
  }
}
```

### Generated Builder API Reference

For a model with scalar fields (`id`, `email`, `name`, `password`) and list relations (`posts`, `books`):

```ts
export class UserModelBuilder {
  protected _args: Partial<UserModelConstructorArgs>;

  // Set all scalars from a Prisma record (with type conversions)
  fromPrisma(value: PrismaUser): this;

  // Individual scalar setters
  id(value: number): this;
  email(value: string): this;
  name(value: string | null): this;
  password(value: string): this;

  // Relation setters
  posts(value: PostWithIncludes[]): this;
  books(value: BookWithIncludes[]): this;

  // Resolve args with validation and defaults (protected for subclasses)
  protected buildArgs(): UserModelConstructorArgs;

  // Construct the model instance
  build(): UserModel;
}
```

#### Default Values in `buildArgs()`

| Field Kind | Default |
|------------|---------|
| Required scalar | Throws `Error` if not set |
| Optional scalar | `null` |
| List relation | `[]` |
| Optional single relation | `undefined` |
| Required single relation | Throws `Error` if not set |

---
---

# frourio-framework-prisma-generators (Japanese / 日本語)

Prisma schema からイミュータブルな TypeScript モデルクラスを自動生成するジェネレーターです。

## 機能一覧

- Prisma schema から型安全なモデルクラスを生成
- `toDto()` メソッドによる DTO 変換（DateTime の ISO 文字列変換、Decimal の number 変換など）
- `fromPrismaValue()` による Prisma Client からの変換
- **Builder パターン** — 柔軟な構築、モデル拡張、テスト fixture 生成
- `Json` 型フィールドのカスタム型指定（`@json` アノテーション）
- フィールド非表示機能（`@dto(hidden: true)` アノテーション）
- カスタム DTO プロファイル（`@dto.profile` アノテーション）
- リレーションフィールドの自動型生成（`WithIncludes` 型）
- 外部キーフィールドの自動除外（リレーションフィールドが存在する場合）
- **リポジトリ生成**（ベータ） — `findBy`、`paginate`、CRUD 付きリポジトリクラスを自動生成

## 要件

- prisma, @prisma/client@7.2.0 以降 **（両方同じバージョンが必要です！）**

## インストール

```bash
npm install -D frourio-framework-prisma-generators
```

## セットアップ

`schema.prisma` にジェネレーター設定を追加します:

```prisma
generator frourio_framework_prisma_model_generator {
    provider = "frourio-framework-prisma-model-generator"
    output   = "__generated__/models"
    additionalTypePath = "./@additionalType/index" // Json 型フィールドに型を指定する場合に必要
}
```

| オプション | 説明 |
|-----------|------|
| `provider` | ジェネレーター名（固定値） |
| `output` | 生成先ディレクトリ（Prisma schema からの相対パス） |
| `additionalTypePath` | `@json` アノテーションで使用する型のインポートパス |

### リポジトリジェネレーター（ベータ）

別のジェネレーターブロックを追加してリポジトリクラスの自動生成を有効にします:

```prisma
generator repository {
    provider  = "frourio-framework-prisma-repository-generator"
    output    = "__generated__/repository"
    modelPath = "__generated__/model"    // モデルジェネレーターの出力パス
}
```

| オプション | 説明 |
|-----------|------|
| `provider` | ジェネレーター名（固定値） |
| `output` | 生成先ディレクトリ（Prisma schema からの相対パス） |
| `modelPath` | モデルジェネレーターの出力パス（import 解決用） |

---

## サンプルコード

[`examples/`](examples/) ディレクトリに動作するサンプルがあります:

### 基本的な使い方

| ファイル | 説明 |
|---------|------|
| [`basic/01-from-prisma-value.ts`](examples/basic/01-from-prisma-value.ts) | `fromPrismaValue` と `toDto` — クエリ、変換、出力 |
| [`basic/02-dto-hidden.ts`](examples/basic/02-dto-hidden.ts) | `@dto(hidden: true)` — `password` 等のセンシティブフィールドを隠す |
| [`basic/03-dto-profiles.ts`](examples/basic/03-dto-profiles.ts) | `@dto.profile` — pick/omit による用途別 DTO |
| [`basic/04-json-typed-fields.ts`](examples/basic/04-json-typed-fields.ts) | `@json` — Json フィールドにカスタム TypeScript 型を指定 |
| [`basic/05-dto-nested.ts`](examples/basic/05-dto-nested.ts) | `@dto(nested: true)` — リレーションをネスト DTO に自動変換 |

### Builder パターン

| ファイル | 説明 |
|---------|------|
| [`builder/01-basic-builder.ts`](examples/builder/01-basic-builder.ts) | 不要なリレーションをスキップ |
| [`builder/02-test-fixture.ts`](examples/builder/02-test-fixture.ts) | Faker を使ったテスト fixture |
| [`builder/03-extend-model.ts`](examples/builder/03-extend-model.ts) | カスタムフィールド追加、Builder 拡張、DTO カスタマイズ |

### リポジトリパターン

| ファイル | 説明 |
|---------|------|
| [`repository/UserRepository.ts`](examples/repository/UserRepository.ts) | 生成されたリポジトリを継承してカスタムクエリを追加 |
| [`repository/JsonField.repository.ts`](examples/repository/JsonField.repository.ts) | ジェネレーターなしのシンプルなリポジトリ利用 |

> **注意:** リポジトリ生成はベータ機能です。別の `repository` ジェネレーターブロックを追加して有効化してください。

---

## リポジトリジェネレーター（ベータ）

リポジトリジェネレーターを有効にすると、以下が生成されます：

- **`BaseRepository`** — CRUD 操作とページネーションを提供する抽象クラス
- **`{Model}Repository`** — モデルごとの具象クラス（自動生成されたクエリメソッド付き）

### 自動生成されるメソッド

スキーマのメタデータに基づいて、各モデルに以下のメソッドが生成されます：

| ソース | 生成されるメソッド | 例 |
|-------|-----------------|-----|
| `@id` フィールド | `findBy{Field}(value)` | `findById(id: number)` |
| `@unique` フィールド | `findBy{Field}(value)` | `findByEmail(email: string)` |
| `@@unique([x, y])` | `findBy{X}And{Y}(x, y)` | `findByBookIdAndPostId(bookId, postId)` |
| 全モデル共通 | `paginate(args?)` | 型付きフィルタリング、ソート、ページネーション |

### 継承メソッド（BaseRepository から）

| メソッド | 説明 |
|---------|------|
| `findMany(args?)` | 条件に一致する全件を取得 |
| `findFirst(args?)` | 条件に一致する最初の1件を取得 |
| `count(args?)` | 条件に一致するレコード数を返す |
| `exists(where)` | 条件に一致するレコードの存在チェック |
| `create(args)` | レコードを作成してモデルを返す |
| `createMany(args)` | 一括作成（件数を返す） |
| `update(args)` | レコードを更新してモデルを返す |
| `updateMany(args)` | 一括更新（件数を返す） |
| `upsert(args)` | レコードの作成または更新 |
| `delete(args)` | レコードを削除してモデルを返す |
| `deleteMany(args?)` | 一括削除（件数を返す） |
| `aggregate(args)` | 集約操作（count, sum, avg, min, max） |
| `cursorPaginate(args)` | カーソルベースのページネーション（大規模データ向け） |
| `withTransaction(tx)` | トランザクションにバインドしたリポジトリインスタンスを生成 |

### 使い方 — 直接利用

```ts
import { PrismaClient } from "@prisma/client";
import { UserRepository } from "./__generated__/repository/User.repository";

const prisma = new PrismaClient();
const userRepo = new UserRepository(prisma.user);

// 自動生成された findBy メソッド
const user = await userRepo.findById(1);
const userByEmail = await userRepo.findByEmail("alice@example.com");

// 型付きフィルタでページネーション
const page = await userRepo.paginate({
  page: 1,
  perPage: 20,
  where: { name: { contains: "alice", mode: "insensitive" } },
  orderBy: { field: "id", direction: "desc" },
});
```

### 使い方 — カスタムメソッドの追加

```ts
import { PrismaClient } from "@prisma/client";
import { UserRepository as GeneratedUserRepository } from "./__generated__/repository/User.repository";

export class UserRepository extends GeneratedUserRepository {
  // カスタムクエリメソッドを追加
  async findActiveUsers() {
    return this.findMany({ where: { active: true } });
  }
}
```

---

## 生成されるモデル構造

各 Prisma モデルに対して、以下が生成されます:

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  title     String
  content   String?
  author    User?    @relation(fields: [authorId], references: [id])
  authorId  Int?
}
```

### DTO 型 (`{Model}ModelDto`)

`toDto()` の戻り値型です。`DateTime` は `string` に変換されます。外部キーフィールド（`authorId` など）はリレーションフィールドがある場合、自動的に除外されます。

```ts
export type PostModelDto = {
  id: number;
  createdAt: string;    // DateTime → string (ISO 8601)
  title: string;
  content?: string | null;
  author?: UserWithIncludes | null;
};
```

### コンストラクタ引数型 (`{Model}ModelConstructorArgs`)

モデルのコンストラクタ引数型です。`DateTime` は `Date` 型のまま保持されます。

```ts
export type PostModelConstructorArgs = {
  id: number;
  createdAt: Date;      // DateTime → Date
  title: string;
  content?: string | null;
  author?: UserWithIncludes | null;
};
```

### FromPrismaValue 引数型 (`{Model}ModelFromPrismaValueArgs`)

`fromPrismaValue()` の引数型です。`self` に Prisma モデルのレコードを、リレーションは個別引数で渡します。

```ts
export type PostModelFromPrismaValueArgs = {
  self: PrismaPost;
  author?: UserWithIncludes;
};
```

### モデルクラス (`{Model}Model`)

イミュータブルなモデルクラスです。全フィールドは `private readonly` で保持され、getter でアクセスします。

```ts
export class PostModel {
  private readonly _id: number;
  private readonly _createdAt: Date;
  private readonly _title: string;
  private readonly _content?: string | null;
  private readonly _author?: UserWithIncludes | null;

  constructor(args: PostModelConstructorArgs) { ... }

  static fromPrismaValue(args: PostModelFromPrismaValueArgs) {
    return new PostModel({
      id: args.self.id,
      createdAt: args.self.createdAt,
      title: args.self.title,
      content: args.self.content,
      author: args.author,
    });
  }

  toDto() {
    return {
      id: this._id,
      createdAt: this._createdAt.toISOString(),
      title: this._title,
      content: this._content,
      author: this._author,
    };
  }

  get id() { return this._id; }
  get createdAt() { return this._createdAt; }
  get title() { return this._title; }
  get content() { return this._content; }
  get author() { return this._author; }
}
```

### リレーション型 (`{Model}WithIncludes`)

リレーションフィールドを持つモデルには `WithIncludes` 型が生成されます。リレーション先のフィールドをオプショナルとして含む型です。

```ts
export type UserWithIncludes = PartialBy<
  Prisma.UserGetPayload<typeof includeUser>,
  keyof (typeof includeUser)['include']
>;
```

---

## 型変換ルール

| Prisma 型 | Constructor / Getter | DTO (`toDto()`) | 変換処理 |
|-----------|---------------------|-----------------|---------|
| `String` | `string` | `string` | なし |
| `Int` | `number` | `number` | なし |
| `Float` | `number` | `number` | なし |
| `Boolean` | `boolean` | `boolean` | なし |
| `DateTime` | `Date` | `string` | `.toISOString()` |
| `Json` | `Prisma.JsonValue` | `Prisma.JsonValue` | なし（`@json` で上書き可） |
| `Decimal` | `number` | `number` | `fromPrismaValue` で `.toNumber()` |
| `BigInt` | `bigint` | `string` | `.toString()` |
| `Bytes` | `Buffer` | `string` | `Buffer.from().toString('base64')` |
| Enum | `Prisma{EnumName}` | `Prisma{EnumName}` | なし |
| Relation | `{Type}WithIncludes` | `{Type}WithIncludes` | なし |

nullable フィールドは `?` 付きで `| null` 型になり、`toDto()` ではオプショナルチェーン（`?.`）と null 合体（`?? null`）で安全に変換されます。

---

## アノテーション

Prisma の `///` ドキュメントコメントを使ったアノテーションシステムです。

### `@json` - Json 型フィールドのカスタム型指定

`Json` 型フィールドに独自の TypeScript 型を指定できます。

#### 構文

```prisma
fieldName Json /// @json(type: [TypeName])
```

#### 設定

`additionalTypePath` にカスタム型のインポート先を指定してください:

```prisma
generator frourio_framework_prisma_model_generator {
    provider           = "frourio-framework-prisma-model-generator"
    output             = "__generated__/models"
    additionalTypePath = "./@additionalType/index"
}
```

#### 使用例

**1. スキーマにアノテーションを追加:**

```prisma
model JsonField {
  id         Int  @id @default(autoincrement())
  rawJson    Json
  jsonObject Json /// @json(type: [JsonObject])
  jsonArray  Json /// @json(type: [JsonArray])
}
```

**2. カスタム型を定義:**

```ts
// prisma/@additionalType/index.ts
export type JsonObject = {
  foo: string;
  bar: number;
};

export type JsonArray = JsonObject[];
```

**3. 生成結果:**

```ts
import { JsonObject, JsonArray } from '../../@additionalType/index';

export type JsonFieldModelDto = {
  id: number;
  rawJson: Prisma.JsonValue;   // アノテーションなし → Prisma.JsonValue
  jsonObject: JsonObject;       // @json → カスタム型
  jsonArray: JsonArray;         // @json → カスタム型
};
```

`fromPrismaValue()` では `as unknown as JsonObject` でキャストされます。

---

### `@dto(hidden: true)` - フィールド非表示

特定のフィールドを `toDto()` の出力と `{Model}ModelDto` 型から除外します。`password` のようなセンシティブなフィールドを API レスポンスに含めたくない場合に使用します。

#### 構文

```prisma
fieldName Type /// @dto(hidden: true)
```

#### 使用例

```prisma
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  name     String?
  password String /// @dto(hidden: true)
}
```

#### 生成結果

```ts
// DTO 型 — password が除外される
export type UserModelDto = {
  id: number;
  email: string;
  name?: string | null;
  // password はここに含まれない
};

export class UserModel {
  private readonly _password: string;  // 内部では保持される

  toDto() {
    return {
      id: this._id,
      email: this._email,
      name: this._name,
      // password は出力されない
    };
  }

  get password() { return this._password; }  // getter ではアクセス可能
}
```

#### 動作仕様

| 対象 | hidden の影響 |
|------|-------------|
| `{Model}ModelDto` 型 | 除外される |
| `toDto()` メソッド | 除外される |
| `{Model}ModelConstructorArgs` 型 | **影響なし**（含まれる） |
| `fromPrismaValue()` | **影響なし**（含まれる） |
| private フィールド | **影響なし**（保持される） |
| getter | **影響なし**（アクセス可能） |

---

### `@dto(nested: true)` - ネスト DTO 変換

リレーションフィールドを `toDto()` 出力時に自動的にそのモデルの DTO 形式に変換します。このアノテーションがない場合、リレーションは Prisma の `WithIncludes` 型のまま渡されます。

#### 構文

```prisma
fieldName Model[] /// @dto(nested: true)
```

#### 使用例

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String
  posts Post[] /// @dto(nested: true)
  books Book[]
}
```

#### 生成結果

```ts
// DTO 型 — posts は PostWithIncludes ではなく PostModelDto を使用
export type UserModelDto = {
  id: number;
  email: string;
  posts: PostModelDto[];        // @dto(nested: true) → ネスト DTO
  books: BookWithIncludes[];    // アノテーションなし → 生の Prisma 型
};

export class UserModel {
  toDto() {
    return {
      id: this._id,
      email: this._email,
      // posts は builder + toDto で自動変換される
      posts: this._posts.map((el) =>
        PostModel.builder().fromPrisma(el).build().toDto()
      ),
      books: this._books,
    };
  }
}
```

#### 動作仕様

| 対象 | nested の影響 |
|------|-------------|
| `{Model}ModelDto` 型 | リレーション型が `{Related}ModelDto` になる |
| `toDto()` メソッド | `builder().fromPrisma().build().toDto()` で自動変換 |
| `{Model}ModelConstructorArgs` 型 | **影響なし**（`WithIncludes` を使用） |
| `fromPrismaValue()` | **影響なし**（`WithIncludes` を使用） |

---

### `@dto.profile` - カスタム DTO プロファイル

用途別に異なる DTO 型とメソッドを生成します。`pick`（指定フィールドのみ含める）または `omit`（指定フィールドを除外）で制御します。

#### 構文

モデルの上に `///` コメントとして記述します:

```prisma
/// @dto.profile(name: ProfileName, pick: [field1, field2, ...])
/// @dto.profile(name: ProfileName, omit: [field1, field2, ...])
model ModelName {
  ...
}
```

- `name`: プロファイル名（PascalCase 推奨）。メソッド名と型名に使用される
- `pick`: 含めるフィールド名のリスト（`omit` と排他）
- `omit`: 除外するフィールド名のリスト（`pick` と排他）

#### 使用例

```prisma
/// @dto.profile(name: Public, pick: [id, email, name])
/// @dto.profile(name: Admin, omit: [password])
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  name     String?
  password String /// @dto(hidden: true)

  posts Post[]
}
```

#### 生成結果

```ts
// デフォルト DTO — @dto(hidden: true) により password が除外
export type UserModelDto = {
  id: number;
  email: string;
  name?: string | null;
  posts: PostWithIncludes[];
};

// Public プロファイル — pick で指定した 3 フィールドのみ
export type UserPublicDto = {
  id: number;
  email: string;
  name?: string | null;
};

// Admin プロファイル — omit で password のみ除外（リレーション含む全フィールド）
export type UserAdminDto = {
  id: number;
  email: string;
  name?: string | null;
  posts: PostWithIncludes[];
};

export class UserModel {
  // デフォルト DTO
  toDto(): UserModelDto { ... }

  // プロファイル DTO
  toPublicDto(): UserPublicDto { ... }
  toAdminDto(): UserAdminDto { ... }
}
```

#### プロファイルと hidden の関係

プロファイルは `@dto(hidden: true)` を **override** します。プロファイルで明示的に `pick` したフィールドは、そのフィールドが hidden であっても含まれます。

```prisma
/// @dto.profile(name: Debug, pick: [id, password])
model User {
  id       Int    @id
  password String /// @dto(hidden: true)
}
```

この場合:
- `toDto()` → `password` は **除外される**（hidden が適用される）
- `toDebugDto()` → `password` は **含まれる**（プロファイルが hidden を override）

#### バリデーション

- `pick` と `omit` を同一プロファイルで同時に指定するとそのプロファイルは無視されます
- 存在しないフィールド名を指定すると警告が出力されスキップされます
- 同じプロファイル名が重複する場合、最初の定義のみ使用されます
- `pick` / `omit` のリストが空の場合、そのプロファイルは生成されません

---

## アノテーションの組み合わせ

複数のアノテーションを同じフィールドに指定できます:

```prisma
model Config {
  id       Int  @id
  settings Json /// @json(type: [SettingsObject]) @dto(hidden: true)
}
```

この場合:
- `settings` は `SettingsObject` 型として内部保持される
- `toDto()` と `ConfigModelDto` からは除外される
- getter (`config.settings`) では `SettingsObject` 型でアクセス可能

---

## Builder パターン

各モデルに `{Model}ModelBuilder` クラスが生成されます。Builder は以下を提供します:

- **リレーション省略** — 不要なリレーションをスキップ（リスト系は `[]` デフォルト）
- **個別スカラーセッター** — Faker と組み合わせたテスト fixture に最適
- **拡張性** — Builder をサブクラス化してカスタムフィールドを追加

> **注意:** `fromPrismaValue()` は厳密なまま変更されません（全リレーション必須）。Builder は柔軟性を選ぶための別経路です。

### 基本的な使い方 — 不要なリレーションをスキップ

```ts
// Before (fromPrismaValue — 全リレーション必須):
const user = UserModel.fromPrismaValue({
  self: prismaUser,
  posts: loadedPosts,
  books: [],                         // 使わなくても必須
  initiatorUserNotification: [],      // 使わなくても必須
  receivingUserNotification: [],      // 使わなくても必須
});

// After (Builder — 必要なものだけ):
const user = UserModel.builder()
  .fromPrisma(prismaUser)            // スカラーフィールドを一括セット
  .posts(loadedPosts)                // ロードしたリレーションだけ
  .build();                          // books, notifications → []
```

### テスト fixture — Faker と組み合わせ

個別スカラーセッターにより、テストデータ生成に最適です:

```ts
import { faker } from "@faker-js/faker";

function createUserFixture(overrides?: Partial<{
  id: number;
  email: string;
  name: string | null;
  password: string;
}>) {
  return UserModel.builder()
    .id(overrides?.id ?? faker.number.int())
    .email(overrides?.email ?? faker.internet.email())
    .name(overrides?.name ?? faker.person.fullName())
    .password(overrides?.password ?? faker.internet.password())
    .build();
  // リレーションは全て [] デフォルト — スカラーだけ指定
}

// テストで:
const user = createUserFixture();
const admin = createUserFixture({ email: "admin@example.com" });
```

### モデル拡張 — カスタムフィールド追加

生成されたモデルと Builder をサブクラス化してカスタムフィールドを追加:

```ts
import {
  UserModel,
  UserModelBuilder,
  UserModelConstructorArgs,
} from "./__generated__/model/User.model";

// 1. モデルを拡張
type AppUserArgs = UserModelConstructorArgs & { fullName: string };

class AppUser extends UserModel {
  private readonly _fullName: string;

  constructor(args: AppUserArgs) {
    super(args);
    this._fullName = args.fullName;
  }

  get fullName() { return this._fullName; }

  override toDto() {
    return { ...super.toDto(), fullName: this._fullName };
  }
}

// 2. Builder を拡張
class AppUserBuilder extends UserModelBuilder {
  private _fullName?: string;

  fullName(value: string): this {
    this._fullName = value;
    return this;
  }

  override build(): AppUser {
    if (!this._fullName) throw new Error('"fullName" is required');
    return new AppUser({
      ...this.buildArgs(),   // protected — サブクラスからアクセス可能
      fullName: this._fullName,
    });
  }
}

// 使用例:
const appUser = new AppUserBuilder()
  .fromPrisma(prismaUser)
  .fullName("John Doe")
  .posts(loadedPosts)
  .build();

appUser.toDto();
// → { id, email, name, posts, ..., fullName }
```

### モデル拡張 — DTO 出力のカスタマイズ

`toDto()` をオーバーライドしてネストしたリレーションをリッチな DTO に変換:

```ts
class UserWithNestedDtos extends UserModel {
  override toDto() {
    return {
      ...super.toDto(),
      posts: this.posts.map((post) =>
        PostModel.builder().fromPrisma(post).build().toDto()
      ),
    };
  }
}
```

### 生成される Builder API リファレンス

スカラーフィールド（`id`, `email`, `name`, `password`）とリスト系リレーション（`posts`, `books`）を持つモデルの場合:

```ts
export class UserModelBuilder {
  protected _args: Partial<UserModelConstructorArgs>;

  // Prisma レコードからスカラーを一括セット（型変換あり）
  fromPrisma(value: PrismaUser): this;

  // 個別スカラーセッター
  id(value: number): this;
  email(value: string): this;
  name(value: string | null): this;
  password(value: string): this;

  // リレーションセッター
  posts(value: PostWithIncludes[]): this;
  books(value: BookWithIncludes[]): this;

  // バリデーション + デフォルト値で引数を解決（サブクラス用 protected）
  protected buildArgs(): UserModelConstructorArgs;

  // モデルインスタンスを構築
  build(): UserModel;
}
```

#### `buildArgs()` のデフォルト値

| フィールド種別 | デフォルト |
|--------------|---------|
| 必須スカラー | 未セット時 `Error` を throw |
| オプショナルスカラー | `null` |
| リスト系リレーション | `[]` |
| オプショナル単一リレーション | `undefined` |
| 必須単一リレーション | 未セット時 `Error` を throw |
