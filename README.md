# frourio-framework-prisma-generators
- Generate model from prisma schema
- Can be compatible with `Json` type field by specifying type 

## Requirements
- prisma, @prisma/client@5.20.0 **(both needs to be same version!)**

## Install

```bash
npm install -D frourio-framework-prisma-generators
```

```prisma
// model generator
generator frourio_framework_prisma_model_generator {
    provider = "frourio-framework-prisma-model-generator"
    output   = "__generated__/models"
    additionalTypePath = "./@additionalType/index.ts" // If you need to type Json type field
}
```

## Typing Prisma Json field
- Please make sure you configure `additionalTypePath` attribute of generateor.

### 1. Add type annotation on your schema
```prisma
model JsonField {
  id Int @id @default(autoincrement())

  rawJson    Json
  jsonObject Json /// @json(type: [JsonObject])
  jsonArray  Json /// @json(type: [JsonArray])
}
```

### 2. Write your type equvalent to the annotated type
```ts
export type JsonObject = {
  foo: string;
  bar: number;
};

export type JsonArray = JsonObject[];
``` 

### 3. Boom 🚀
- Now your model can type the Json field with your annotated type

```ts
import type { JsonValue } from '@prisma/client/runtime/library';
import { JsonField as PrismaJsonField } from '@prisma/client';
import { JsonObject, JsonArray } from '../../@additionalType/index.ts';

export interface JsonFieldModelDto {
  id: number;
  rawJson: JsonValue;
  jsonObject: JsonObject;
  jsonArray: JsonArray;
}

export type JsonFieldModelConstructorArgs = {
  id: number;
  rawJson: JsonValue;
  jsonObject: JsonObject;
  jsonArray: JsonArray;
};

export type JsonFieldModelFromPrismaValueArgs = {
  self: PrismaJsonField;
};

export class JsonFieldModel {
  private readonly _id: number;
  private readonly _rawJson: JsonValue;
  private readonly _jsonObject: JsonObject;
  private readonly _jsonArray: JsonArray;

  constructor(args: JsonFieldModelConstructorArgs) {
    this._id = args.id;
    this._rawJson = args.rawJson;
    this._jsonObject = args.jsonObject;
    this._jsonArray = args.jsonArray;
  }

  static fromPrismaValue(args: JsonFieldModelFromPrismaValueArgs) {
    return new JsonFieldModel({
      id: args.self.id,
      rawJson: args.self.rawJson,
      jsonObject: args.self.jsonObject as JsonObject,
      jsonArray: args.self.jsonArray as JsonArray,
    });
  }

  toDto() {
    return {
      id: this._id,
      rawJson: this._rawJson,
      jsonObject: this._jsonObject,
      jsonArray: this._jsonArray,
    };
  }

  get id() {
    return this._id;
  }

  get rawJson() {
    return this._rawJson;
  }

  get jsonObject() {
    return this._jsonObject;
  }

  get jsonArray() {
    return this._jsonArray;
  }
}
```

## Using `fromPrismaValue` with Relations

When your models have relations, the generated `fromPrismaValue` method supports generic types to handle selective field inclusion. This allows you to work with Prisma queries that include or exclude related data.

### Type-Safe Relation Handling

For models with relations, the generator creates:
- **`WithIncludes` types** for each related model
- **Generic type parameters** on `fromPrismaValue` to specify which fields are included
- **Flexible type constraints** that allow `undefined`, `null`, or the full relation type

### Example: Model with Relations

Given this Prisma schema:

```prisma
model Book {
  id        Int      @id @default(autoincrement())
  title     String
  authorId  Int?
  author    Author?  @relation(fields: [authorId], references: [id])
  reviews   Review[]
}

model Author {
  id    Int    @id @default(autoincrement())
  name  String
  books Book[]
}

model Review {
  id      Int    @id @default(autoincrement())
  content String
  bookId  Int
  book    Book   @relation(fields: [bookId], references: [id])
}
```

The generator creates:

```ts
export type BookWithIncludes = PartialBy<
  Prisma.BookGetPayload<typeof includeBook>,
  keyof (typeof includeBook)["include"]
>;

export type BookModelFromPrismaValueArgs<
  TAuthor extends AuthorWithIncludes | null | undefined = AuthorWithIncludes | null,
  TReviews extends ReviewWithIncludes[] | undefined = ReviewWithIncludes[]
> = {
  self: PrismaBook;
  author?: TAuthor;
  reviews?: TReviews;
};

export class BookModel {
  // ... fields and constructor ...

  static fromPrismaValue<
    TAuthor extends AuthorWithIncludes | null | undefined = AuthorWithIncludes | null,
    TReviews extends ReviewWithIncludes[] | undefined = ReviewWithIncludes[]
  >(args: BookModelFromPrismaValueArgs<TAuthor, TReviews>) {
    return new BookModel({
      id: args.self.id,
      title: args.self.title,
      author: args.author,
      reviews: args.reviews,
    });
  }
}
```

### Usage Examples

#### 1. With All Relations Included

```ts
const bookWithRelations = await prisma.book.findUnique({
  where: { id: 1 },
  include: {
    author: true,
    reviews: true,
  },
});

const bookModel = BookModel.fromPrismaValue({
  self: bookWithRelations,
  author: bookWithRelations.author,
  reviews: bookWithRelations.reviews,
});
```

#### 2. With Partial Relations

```ts
const bookWithAuthor = await prisma.book.findUnique({
  where: { id: 1 },
  include: {
    author: true,
  },
});

// TypeScript knows reviews is undefined
const bookModel = BookModel.fromPrismaValue({
  self: bookWithAuthor,
  author: bookWithAuthor.author,
  reviews: undefined,
});
```

#### 3. Without Any Relations

```ts
const bookOnly = await prisma.book.findUnique({
  where: { id: 1 },
});

const bookModel = BookModel.fromPrismaValue({
  self: bookOnly,
  author: undefined,
  reviews: undefined,
});
```

#### 4. With Partial Field Selection using `select`

The `fromPrismaValue` method supports partial objects from Prisma's `select` queries through its generic `TSelf` parameter:

```ts
// Selecting only specific fields
const partialBook = await prisma.book.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    title: true,
    author: {
      select: {
        id: true,
        name: true,
      },
    },
  },
});

// TypeScript automatically infers the partial type
// No type casting needed! The TSelf generic handles partial objects
const bookModel = BookModel.fromPrismaValue({
  self: partialBook, // Works with partial objects
  author: partialBook.author,
  reviews: undefined,
});

// You can also explicitly specify the partial type
type PartialBookSelect = {
  id: number;
  title: string;
  author: { id: number; name: string } | null;
};

const bookModelExplicit = BookModel.fromPrismaValue<PartialBookSelect>({
  self: partialBook,
  author: partialBook.author,
  reviews: undefined,
});
```

**How Partial Selection Works:**

The generated type signature includes a `TSelf` generic parameter:
```ts
static fromPrismaValue<
  TSelf extends Partial<PrismaBook> = PrismaBook,
  TAuthor extends AuthorWithIncludes | null | undefined = AuthorWithIncludes | null,
  TReviews extends ReviewWithIncludes[] | undefined = ReviewWithIncludes[]
>(args: BookModelFromPrismaValueArgs<TSelf, TAuthor, TReviews>) {
  // ...
}
```

This allows you to:
- ✅ Pass partial objects from `select` queries without type casting
- ✅ Maintain type safety for the fields you did select
- ✅ Let TypeScript infer the partial type automatically
- ✅ Work with any combination of selected fields

**Note:** The model's internal fields will only contain the data you selected. Accessing unselected fields through getters will return `undefined`.

#### 5. Type Inference with Custom Types

```ts
// TypeScript infers the exact types based on your query
const customBook = await prisma.book.findUnique({
  where: { id: 1 },
  include: { author: true },
});

// Type parameters are automatically inferred:
// TAuthor = Author | null, TReviews = undefined
const bookModel = BookModel.fromPrismaValue({
  self: customBook,
  author: customBook.author,
  reviews: undefined,
});
```

### Key Features

- **Type Safety**: TypeScript ensures you pass the correct types for each relation
- **Flexibility**: Works with any combination of included/excluded relations
- **Null Safety**: Handles nullable relations correctly
- **Array Relations**: Properly types one-to-many relationships
- **Type Inference**: Generic types are often automatically inferred from your Prisma queries

## Dynamic DTO Types with `toDto()`

When working with models that have relations, the `toDto()` method now returns a **dynamic DTO type** that accurately reflects which relations were actually loaded. This prevents frontend code from assuming relations exist when they were never fetched.

### How It Works

For models with relations, two DTO types are generated:

1. **`ModelDto`**: Static type with all relations (legacy compatibility)
2. **`ModelDtoWithRelations<...>`**: Generic type that reflects actual loaded relations

The model class itself is generic, and `toDto()` uses those generics to return the correct DTO type.

### Generated Types Example

```ts
// Static DTO (all relations)
export type PostModelDto = {
  id: number;
  title: string;
  author?: UserWithIncludes | null;
  comments: CommentWithIncludes[];
};

// Dynamic DTO (reflects loaded relations)
export type PostModelDtoWithRelations<
  TSelf extends Partial<PrismaPost> = PrismaPost,
  TAuthor extends UserWithIncludes | null | undefined = UserWithIncludes | null,
  TComments extends CommentWithIncludes[] | undefined = CommentWithIncludes[]
> = {
  id: number;
  title: string;
  author?: TAuthor;
  comments: TComments;
};

// Generic model class
export class PostModel<
  TSelf extends Partial<PrismaPost> = PrismaPost,
  TAuthor extends UserWithIncludes | null | undefined = UserWithIncludes | null,
  TComments extends CommentWithIncludes[] | undefined = CommentWithIncludes[]
> {
  // ...
  toDto(): PostModelDtoWithRelations<TSelf, TAuthor, TComments> {
    // Returns DTO with actual loaded relation types
  }
}
```

### Usage Examples

#### 1. Post with No Relations Loaded

```ts
const post = await prisma.post.findUnique({ where: { id: 1 } });

const postModel = PostModel.fromPrismaValue({
  self: post,
  author: undefined,
  comments: undefined,
});

const dto = postModel.toDto();
// Type: { id: number, title: string, author: undefined, comments: undefined }
// ✅ Frontend knows author and comments are NOT loaded
```

#### 2. Post with Author Only

```ts
const post = await prisma.post.findUnique({
  where: { id: 1 },
  include: { author: true },
});

const postModel = PostModel.fromPrismaValue({
  self: post,
  author: post.author,
  comments: undefined,
});

const dto = postModel.toDto();
// Type: { id: number, title: string, author: UserWithIncludes | null, comments: undefined }
// ✅ Frontend knows author MAY exist, but comments are NOT loaded
```

#### 3. Post with All Relations

```ts
const post = await prisma.post.findUnique({
  where: { id: 1 },
  include: {
    author: true,
    comments: true,
  },
});

const postModel = PostModel.fromPrismaValue({
  self: post,
  author: post.author,
  comments: post.comments,
});

const dto = postModel.toDto();
// Type: { id: number, title: string, author: UserWithIncludes | null, comments: CommentWithIncludes[] }
// ✅ Frontend knows all relations are loaded
```

### Benefits

- **🎯 Type Safety**: Frontend gets accurate types based on what was actually loaded
- **🚫 Prevents Bugs**: `undefined` type clearly indicates unloaded relations
- **💡 IntelliSense**: IDE shows exactly which fields are available
- **📝 Self-Documenting**: Type signature documents API response shape
- **⚡ No Runtime Checks**: TypeScript catches missing data at compile time

### Migration from Non-Generic DTOs

If you're upgrading from an older version, your existing code will continue to work:

```ts
// Old code (still works)
const post = PostModel.fromPrismaValue({ self: prismaPost });
const dto = post.toDto();
// Type: PostModelDto (legacy type with all relations)

// New code (type-safe)
const post = PostModel.fromPrismaValue({
  self: prismaPost,
  author: undefined,
  comments: undefined,
});
const dto = post.toDto();
// Type: PostModelDtoWithRelations<..., undefined, undefined>
// Frontend knows these relations are NOT loaded
```

### Best Practices

1. **Always specify relation parameters**: Even if `undefined`, be explicit
   ```ts
   // ✅ Good
   PostModel.fromPrismaValue({
     self: post,
     author: undefined,
     comments: undefined,
   });
   
   // ❌ Avoid (loses type safety)
   PostModel.fromPrismaValue({ self: post });
   ```

2. **Use the dynamic DTO type in API responses**:
   ```ts
   // API handler
   async function getPost(id: number) {
     const post = await prisma.post.findUnique({
       where: { id },
       include: { author: true },
     });
     
     const model = PostModel.fromPrismaValue({
       self: post,
       author: post.author,
       comments: undefined,
     });
     
     return model.toDto();
     // Return type automatically reflects loaded relations
   }
   ```

3. **Frontend can trust the types**:
   ```ts
   const dto = await api.getPost(1);
   
   // TypeScript knows:
   if (dto.author !== undefined) {
     // Author was loaded, safe to access
     console.log(dto.author.name);
   }
   
   if (dto.comments !== undefined) {
     // Comments were loaded, safe to iterate
     dto.comments.forEach(comment => ...);
   }
   ```
