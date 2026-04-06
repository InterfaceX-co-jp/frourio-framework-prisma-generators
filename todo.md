# Repository Generator — Production Readiness TODO

## Critical（機能が壊れている / 期待と違う動作）

- [ ] **findByXXX に include/select を渡せない** — リレーション込みで取得する手段がない。options 引数を追加する
- [ ] **toModel がリレーションを無視する** — `include` で取得してもモデルにセットされない。`builder().fromPrisma()` はスカラーのみ。リレーションフィールドを検出して builder にセットするコードを生成する
- [ ] **配列フィールドの WhereFilter が間違い** — `intArray Int[]` に対して `number` フィルタを生成しているが、Prisma は `{ has, hasEvery, hasSome, isEmpty }` を使う
- [ ] **Enum のフィルタ型が `string`** — Prisma の enum 型（`PrismaPolymorphicRelationType` 等）を使うべき
- [ ] **Book の `@unique` が `findById` として生成される** — `id Int @unique`（`@id` ではない）のケースで `findById` が生成されるが、意味的に `findById` は `@id` のみにすべき

## Medium（実用上よく必要になる機能の欠如）

- [ ] **null フィルタリング未対応** — `where: { name: null }` や `{ not: null }` が WhereFilter 型で表現できない
- [ ] **upsert 未対応** — `create or update` パターンがない
- [ ] **createMany / updateMany / deleteMany 未対応** — バッチ操作ができない
- [ ] **paginate で include が渡せない** — ページネーション結果にリレーションを含められない
- [ ] **BaseRepository の型安全性が低い** — `PrismaDelegate` が全メソッド `any` で、Prisma の実際の型推論が効かない
- [ ] **FK フィールドが WhereFilter / OrderBy に含まれる** — model 側は FK を除外しているが、repository 側には `authorId` 等が残っている（一貫性の問題）

## Low（あると嬉しい）

- [ ] **カーソルベースのページネーション未対応** — 大量データ時にオフセットより効率的
- [ ] **aggregate (sum/avg/min/max) 未対応** — 集計操作
- [ ] **トランザクションサポート** — `$transaction` 内でリポジトリを使う仕組みがない
- [ ] **リレーションフィルタリング** — `where: { posts: { some: { published: true } } }` のような関連モデルでの絞り込み
