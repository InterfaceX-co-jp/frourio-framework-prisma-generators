# frourio-framework-prisma-generators

Prisma schema から TypeScript の Model クラス・DTO 型・Repository を自動生成します。

## Requirements

- prisma, @prisma/client@7.2.0 以上 **(バージョン一致必須)**

## Install

```bash
npm install -D frourio-framework-prisma-generators
```

## Setup

`schema.prisma` にジェネレーターを追加します。

```prisma
generator model {
  provider           = "frourio-framework-prisma-model-generator"
  output             = "__generated__/model"
  additionalTypePath = "./@additionalType/index"  // Json型指定が必要な場合
  spec               = "./dto.config.ts"
}

generator repository {
  provider  = "frourio-framework-prisma-repository-generator"
  output    = "__generated__/repository"
  modelPath = "./__generated__/model"
  spec      = "./dto.config.ts"
}
```

---

## Spec ファイル（defineModelDto）

`dto.config.ts` を作成し、モデルごとの設定を記述します。  
**DTO アノテーション・プロファイル・ビューをすべてここで管理できます。**

```ts
// prisma/dto.config.ts
import { registerModelDtos, defineModelDto } from "frourio-framework-prisma-generators/spec";

export default registerModelDtos([
  defineModelDto("User", {
    // DTO 設定
    base: {
      fields: {
        password: { hide: true },    // DTOから除外
        posts: { nested: true },     // リレーションをネストDTOとして展開
      },
      profiles: [
        { name: "Public", pick: ["id", "email", "name"] },
        { name: "Admin", omit: ["password"] },
      ],
    },
    // View 定義
    views: {
      profile: {
        select: {
          id: true,
          email: true,
          name: true,
          posts: {
            select: { id: true, title: true, published: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      listItem: {
        select: { id: true, email: true, name: true },
      },
    },
  }),
]);
```

---

## ベース設定（`base`）

### フィールドアノテーション（`base.fields`）

| オプション | 説明 |
|-----------|------|
| `hide: true` | フィールドを全DTOから除外 |
| `nested: true` | リレーションを `XxxModelDto` として展開 |
| `map: { KEY: "label" }` | enum→ラベルの静的マッピング |

### プロファイル（`base.profiles`）

特定フィールドだけを含む・除く専用DTO型を生成します。

```ts
profiles: [
  { name: "Public", pick: ["id", "email", "name"] },  // pick: 含めるフィールド
  { name: "Admin", omit: ["password"] },               // omit: 除くフィールド
]
```

生成される型・メソッド:
- `UserPublicDto` — pick したフィールドのみ
- `UserAdminDto` — omit したフィールド以外
- `model.toPublicDto()` / `model.toAdminDto()`

### schema.prisma アノテーションとの関係

`defineModelDto` の `base` 設定と schema.prisma のコメントアノテーション（`@dto.hide` など）は**併用可能**です。  
同名のプロファイルは spec ファイル側が優先されます。

schema.prisma のアノテーション記法（互換）:

```prisma
/// @dto.profile(name: Public, pick: [id, email, name])
model User {
  password String /// @dto.hide
  posts    Post[] /// @dto(nested: true)
}
```

---

## View 定義（`views`）

View は Prisma の `select` 形状を名前付きで定義し、View 型・DTO 型・Repository メソッドを生成します。

### Select View

```ts
views: {
  detail: {
    select: {
      id: true,
      title: true,
      author: { select: { id: true, name: true } },
    },
    // オプション: フィールドの変換
    transforms: {
      "status": { DRAFT: "下書き", PUBLISHED: "公開" },
    },
    // オプション: 計算フィールド
    computed: {
      summary: {
        type: "string",
        from: (v) => `${v.title} (${v.published ? "公開" : "非公開"})`,
      },
    },
  },
}
```

### Raw View

任意の Prisma クエリで取得した結果をDTOにマップします。

```ts
views: {
  stats: {
    raw: async (prisma, args: { userId: number }) =>
      prisma.post.aggregate({ where: { authorId: args.userId }, _count: true }),
    map: (row) => ({ count: row._count }),
  },
}
```

---

## Json 型指定（`@json`）

Json フィールドに TypeScript 型を付けます。

### 1. schema.prisma にアノテーション追加

```prisma
model JsonField {
  id         Int  @id @default(autoincrement())
  rawJson    Json
  jsonObject Json /// @json(type: [JsonObject])
  jsonArray  Json /// @json(type: [JsonArray])
}
```

### 2. 型定義ファイルを作成

`additionalTypePath` に指定したパスに型をエクスポートします。

```ts
// @additionalType/index.ts
export type JsonObject = { foo: string; bar: number };
export type JsonArray = JsonObject[];
```

### 3. 生成結果

```ts
export type JsonFieldModelDto = {
  id: number;
  rawJson: Prisma.JsonValue;
  jsonObject: JsonObject;
  jsonArray: JsonArray;
};
```

---

## 生成される成果物

### Model クラス（`__generated__/model`）

各モデルごとに以下を生成します:

- `XxxModelDto` — 基本DTO型
- `XxxPublicDto` / `XxxAdminDto` — プロファイル別DTO型
- `XxxModel` — ドメインモデルクラス（`toDto()`, `toPublicDto()`, `clone()`, `equals()` など）
- `XxxModelBuilder` — ビルダーパターン（`fromPrisma()`, `build()` など）

### View 型・Repository（`__generated__/repository`）

各Viewごとに型付きのクエリメソッドを生成します。
