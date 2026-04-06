# Model Generator — Production Readiness TODO

## Critical（機能が壊れている / 期待と違う動作）

- [x] **BigInt / Bytes が DTO で JSON シリアライズ不可** — `toDto()` で BigInt→`.toString()`, Bytes→`Buffer.from().toString('base64')` に変換
- [x] **Builder の JSON カスタム型セッターが `Prisma.JsonValue` を受ける** — `resolveFieldType()` で `@json` アノテーションを考慮
- [x] **`removeRelationFromFieldsId` が部分一致で誤除外する可能性** — lookbehind/lookahead 正規表現に置換

## Medium（実用上よく必要になる機能の欠如）

- [ ] **`@default` / `@updatedAt` フィールドが Builder で必須扱い** — `createdAt DateTime @default(now())` や `updatedAt @updatedAt` は Prisma が自動設定するが、Builder は `undefined` だとエラーを投げる。`@default` / `@updatedAt` 付きフィールドは Builder で optional にすべき
- [ ] **`fromPrismaValue` でリレーションを手動で渡す必要がある** — `PostModel.fromPrismaValue({ self: post, author: post.author, polymorphic: post.Polymorphic })` のように include 結果を個別に渡す必要がある。Prisma の include 結果から自動的にリレーションを抽出できると利便性が上がる
- [ ] **Nested DTO 変換が `builder().fromPrisma()` で失われる** — `User.toDto()` で `posts` を `PostModel.builder().fromPrisma(el).build().toDto()` しているが、`fromPrisma` はスカラーのみ。Post にさらに nested なリレーションがあると変換されない
- [ ] **`WithIncludes` 型が複数ファイルに重複定義される** — `PostWithIncludes` が `User.model.ts` と他のファイルに同一定義される。共通の barrel ファイルに集約すべき
- [ ] **`Omit` / `PartialBy` ヘルパー型が全ファイルに重複** — 共通ユーティリティファイルに抽出すべき
- [ ] **barrel ファイル (`index.ts`) が未生成** — `import { UserModel, PostModel } from './__generated__/model'` ができない
- [ ] **Decimal 配列が `toNumber()` 変換されない** — `Decimal[]` フィールドがあった場合、`fromPrismaValue` / `fromPrisma` で `.toNumber()` 変換が配列対応していない
- [ ] **テストスイートが存在しない** — transformer のユニットテストがない。フィールド型ごとの変換、DTO 生成、Builder バリデーション等のテストが必要

## Low（あると嬉しい）

- [ ] **Getter の戻り型が暗黙的** — `get name()` に明示的な戻り型アノテーションがない。`readonly` プロパティから推論されるが、IDE での可読性のため明示すると良い
- [ ] **Model クラスの `equals` / `clone` メソッドがない** — 値オブジェクトとしての比較やコピーができない
- [ ] **Builder の `merge` / `fromPartial` がない** — 部分的な更新のために既存のモデルから Builder を作る手段がない
- [ ] **`@map` / `@@map` サポート** — DB カラム名とフィールド名が異なる場合の考慮（現状 Prisma の DMMF が処理するが、一部エッジケースがあり得る）
- [ ] **Composite types (Prisma 未対応) の将来的な備え** — Prisma が composite types を導入した場合の拡張性

---

# Repository Generator — Production Readiness TODO

## Critical（機能が壊れている / 期待と違う動作）

- [x] **findByXXX に include/select を渡せない** — `FindOptions` 引数を追加
- [x] **toModel がリレーションを無視する** — リレーションフィールドを検出して builder にセットするコードを生成
- [x] **配列フィールドの WhereFilter が間違い** — `{ has, hasEvery, hasSome, isEmpty }` に修正
- [x] **Enum のフィルタ型が `string`** — Prisma の enum 型を import して使用
- [x] **Book の `@unique` が `findById` として生成される** — `@id` と `@unique` を正しく区別

## Medium（実用上よく必要になる機能の欠如）

- [x] **null フィルタリング** — WhereFilter に `| null` と `not?: ... | null` を追加
- [x] **upsert** — BaseRepository に追加
- [x] **createMany / updateMany / deleteMany** — BaseRepository に追加
- [x] **paginate で include** — PaginateArgs に `include` を追加、BaseRepository の paginate に反映
- [x] **BaseRepository の型安全性** — `exists()` メソッド追加、`BatchResult` 型を追加
- [x] **FK フィールドが WhereFilter / OrderBy に含まれる** — FK を除外する `getScalarFieldsExcludingFk` を導入

## Low（あると嬉しい）

- [x] **カーソルベースのページネーション** — `cursorPaginate()` メソッドを BaseRepository + モデルごとに生成。型付き `CursorPaginateArgs`
- [x] **aggregate (sum/avg/min/max)** — BaseRepository に `aggregate()` メソッド追加
- [x] **トランザクションサポート** — `withTransaction(txDelegate)` メソッドで tx 内リポジトリを生成
- [x] **リレーションフィルタリング** — WhereFilter にリレーションフィールド（`some/every/none`, `is/isNot`）を追加
