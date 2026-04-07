/**
 * Extending Generated Models
 *
 * Inherit from the generated model and builder to add custom fields,
 * computed properties, or override toDto() for custom output.
 */
import {
  UserModel,
  UserModelBuilder,
  UserModelConstructorArgs,
} from "../../prisma/__generated__/model/User.model";
import { PostModel } from "../../prisma/__generated__/model/Post.model";

// ============================================================
// 1. Add custom fields via inheritance
// ============================================================

type AppUserArgs = UserModelConstructorArgs & {
  fullName: string;
  avatarUrl?: string | null;
};

class AppUser extends UserModel {
  private readonly _fullName: string;
  private readonly _avatarUrl: string | null;

  constructor(args: AppUserArgs) {
    super(args);
    this._fullName = args.fullName;
    this._avatarUrl = args.avatarUrl ?? null;
  }

  get fullName() {
    return this._fullName;
  }

  get avatarUrl() {
    return this._avatarUrl;
  }

  override toDto() {
    return {
      ...super.toDto(),
      fullName: this._fullName,
      avatarUrl: this._avatarUrl,
    };
  }
}

// ============================================================
// 2. Extend the builder for AppUser
// ============================================================

class AppUserBuilder extends UserModelBuilder {
  private _fullName?: string;
  private _avatarUrl?: string | null;

  fullName(value: string): this {
    this._fullName = value;
    return this;
  }

  avatarUrl(value: string | null): this {
    this._avatarUrl = value;
    return this;
  }

  override build(): AppUser {
    if (!this._fullName) {
      throw new Error('AppUserBuilder: "fullName" is required');
    }
    return new AppUser({
      ...this.buildArgs(), // access the generated model's resolved args
      fullName: this._fullName,
      avatarUrl: this._avatarUrl ?? null,
    });
  }
}

// Usage:
// const appUser = new AppUserBuilder()
//   .fromPrisma(prismaUser)
//   .fullName("John Doe")
//   .avatarUrl("https://example.com/avatar.jpg")
//   .posts(loadedPosts)
//   .build();
//
// appUser.toDto()
// → { id, email, name, posts, books, ..., fullName, avatarUrl }

// ============================================================
// 3. Custom DTO with nested model conversion
// ============================================================

// Option A: Use a separate method name (avoids return type conflict)
class UserWithNestedDtos extends UserModel {
  toRichDto() {
    const base = super.toDto();
    return {
      ...base,
      // Convert raw Prisma relations into rich model DTOs
      posts: this.posts.map((post) =>
        PostModel.builder().fromPrisma(post).build().toDto(),
      ),
    };
  }
}

// Option B: Composition pattern (wrap instead of extend)
class RichUserDto {
  constructor(private readonly _user: UserModel) {}

  toDto() {
    const base = this._user.toDto();
    return {
      ...base,
      posts: this._user.posts.map((post) =>
        PostModel.builder().fromPrisma(post).build().toDto(),
      ),
    };
  }
}

// Usage:
// const user = UserModel.builder()
//   .fromPrisma(prismaUser)
//   .posts(rawPosts)
//   .build();
//
// const dto = new RichUserDto(user).toDto();
// dto.posts[0].createdAt  // → ISO string (PostModelDto)
