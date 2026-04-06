# Model Generator — Production Readiness TODO

## Critical（機能が壊れている / 期待と違う動作）

- [x] **BigInt / Bytes が DTO で JSON シリアライズ不可** — `toDto()` で BigInt→`.toString()`, Bytes→`Buffer.from().toString('base64')` に変換
- [x] **Builder の JSON カスタム型セッターが `Prisma.JsonValue` を受ける** — `resolveFieldType()` で `@json` アノテーションを考慮
- [x] **`removeRelationFromFieldsId` が部分一致で誤除外する可能性** — lookbehind/lookahead 正規表現に置換

## Medium（実用上よく必要になる機能の欠如）

- [x] **`@default` / `@updatedAt` フィールドが Builder で必須扱い** — `hasDefaultOrUpdatedAt()` でフィールドを判定し、ConstructorArgs と Builder で optional に
- [x] **`fromPrismaValue` でリレーションを手動で渡す必要がある** — リレーション引数を optional 化し、`self` から自動抽出にフォールバック
- [x] **Nested DTO 変換が `builder().fromPrisma()` で失われる** — `fromPrisma` でリレーションも `(value as any).fieldName` で自動抽出
- [x] **`WithIncludes` 型が複数ファイルに重複定義される** — `_shared.ts` に集約し各モデルからインポート
- [x] **`Omit` / `PartialBy` ヘルパー型が全ファイルに重複** — `_shared.ts` に集約
- [x] **barrel ファイル (`index.ts`) が未生成** — `transform()` の最後で全モデル + `_shared` を re-export する `index.ts` を生成
- [x] **Decimal 配列が `toNumber()` 変換されない** — `isList` チェックを追加し `.map((el: any) => el.toNumber())` に
- [x] **テストスイートが存在しない** — `tests/model-transformer.test.ts` (23テスト) を追加 + 既存テストを `_shared.ts` / `index.ts` 生成に対応

## Low（あると嬉しい）

- [ ] **Getter の戻り型が暗黙的** — `get name()` に明示的な戻り型アノテーションがない。`readonly` プロパティから推論されるが、IDE での可読性のため明示すると良い
- [ ] **Model クラスの `equals` / `clone` メソッドがない** — 値オブジェクトとしての比較やコピーができない
- [ ] **Builder の `merge` / `fromPartial` がない** — 部分的な更新のために既存のモデルから Builder を作る手段がない
- [ ] **`@map` / `@@map` サポート** — DB カラム名とフィールド名が異なる場合の考慮（現状 Prisma の DMMF が処理するが、一部エッジケースがあり得る）
- [ ] **Composite types (Prisma 未対応) の将来的な備え** — Prisma が composite types を導入した場合の拡張性

## Infrastructure（テスト・CI/CD・品質基盤）

- [x] **テストスイート導入** — vitest で model/repository transformer テスト + パーサーテスト、全65テスト合格
- [x] **エラーハンドリング修正** — model/repository 両方の `generate.ts` で `process.exit(1)` を追加
- [x] **GitHub Actions にテスト・typecheck ワークフロー追加** — `.github/workflows/ci.yml` で lint + typecheck + test を PR ゲートに
- [x] **ESLint 設定の追加** — `eslint.config.mjs` (flat config) + `package.json` に `lint` スクリプト追加
- [ ] **大規模スキーマでのベンチマーク** — 100+ model のスキーマでジェネレータのパフォーマンスを検証する

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
