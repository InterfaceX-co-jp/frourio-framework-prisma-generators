# Phase 1 sub-PR 2: view file generation

**branch**: `feature/view-generation` → `epic/view-driven-dto`

---

## ゴール

`npm run generate` 実行時に spec の各 view から `prisma/__generated__/views/<Model>.views.ts` を生成する。  
`npm run typecheck:generated` がグリーン。

---

## 生成物 (1モデル × 1ビュー)

```ts
// prisma/__generated__/views/User.views.ts

import type { Prisma } from "@prisma/client";

// --- profile view ---

export const userProfileSelect = {
  id: true,
  email: true,
  name: true,
  posts: { select: { id: true, title: true, published: true }, orderBy: { createdAt: "desc" } },
} as const satisfies Prisma.UserSelect;

export type UserProfileView = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

export type UserProfileDto = {
  id: number;
  email: string;
  name: string | null;
  posts: Array<{ id: number; title: string; published: boolean }>;
};

export function toUserProfileDto(v: UserProfileView): UserProfileDto {
  return {
    id: v.id,
    email: v.email,
    name: v.name,
    posts: v.posts,
  };
}

// --- listItem view ---
// ...
```

---

## タスク

### 1. views transformer 作成 (`src/generators/views/`)

- [ ] `src/generators/views/transformer.ts` — `ViewsTransformer` クラス
  - `_spec: ViewsSpec` + `_outputPath` 保持
  - `transform()` → モデルごとにファイル生成
- [ ] `src/generators/views/generate.ts` — transformer 呼び出し
- [ ] `src/generators/views/index.ts` + `generator.ts`

### 2. 型生成ロジック

各 view ごとに以下を emit:

- `{model}{View}Select` — `as const satisfies Prisma.{Model}Select`
- `{Model}{View}View` — `Prisma.{Model}GetPayload<{ select: typeof ...Select }>`
- `{Model}{View}Dto` — select shape から再帰的にフラット型生成
  - scalar: Prisma 型 → TS 型 (`String`→`string`, `Int`/`Float`/`Decimal`→`number`, `Boolean`→`boolean`, `DateTime`→`Date`, `BigInt`→`bigint`, `Bytes`→`Uint8Array`, `Json`→`unknown`)
  - nested select: 再帰的に処理
  - nullable/optional: `| null` / `?` を元 schema から反映
- `to{Model}{View}Dto(v: {Model}{View}View): {Model}{View}Dto` — identity map (Phase 1 は transforms なし)

### 3. model generator に views 生成統合

- [ ] `src/generators/model/generate.ts` で spec 存在時に `ViewsTransformer` も呼び出す
  - output path: `{modelOutput}/../views` or configurable

### 4. tsconfig.generated.json 更新

- [ ] `prisma/__generated__/views/**/*.ts` を include に追加

### 5. テスト

- [ ] `tests/viewsTransformer.test.ts`
  - User.profile view の select → 正しい Select const / View 型 / Dto 型 / mapper 生成を文字列検証
  - nested select (posts) の再帰展開
  - nullable フィールドの `| null`

---

## 技術的考慮

### select → Dto 型の再帰解析

spec の select は runtime 値 (plain object)。DMMF で型情報なし。  
→ Dto 型を正確に生成するには DMMF モデル情報と select を突合が必要。

**戦略**: DMMF から型情報参照、select の `true`/`{ select: {...} }` で分岐:
- `true` → DMMF フィールド型をそのまま
- `{ select: {...} }` → 再帰 (relation フィールド)
- `{ select: {...}, orderBy: {...} }` → select 部分のみ再帰 (orderBy は無視)

### select const の型

`as const satisfies Prisma.{Model}Select` で value 型を保持しつつ Prisma 型でチェック。  
Phase 1 は orderBy 等を含む nested object もそのまま出力。

### Dto 生成でDMMF不要のフォールバック

DMMF の relation 型解決が複雑な場合:  
`{Model}{View}View` から型を導出する方向 (`UnwrapView<typeof ...Select>` ヘルパー) も検討。  
Phase 1 は DMMF 参照でシンプル実装。

---

## 完了条件

```bash
npm run generate               # views/*.ts 生成
npm run typecheck:generated    # グリーン (spec + generated 全ファイル)
npm test                       # 全テスト合格
npm run typecheck              # src/ グリーン
```
