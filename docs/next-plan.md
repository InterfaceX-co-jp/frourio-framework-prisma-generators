# View-Driven DTO Generation Plan

現ジェネレータ(~v7.3)の構造的限界を解消し、Prisma `select` ベースの柔軟なビュー/DTO 生成を可能にする計画。

## 背景 / 解決したい問題

v7 までの生成物は以下の限界あり:

### 1. `select` で絞った型との互換性欠如

生成 `*ModelDto` 型の relation 部分は `PartialBy<Prisma.*GetPayload<{ include: {...} }>, ...>` で定義される。各 relation は "全 include 可能" 想定のため、実際に `select: { id, name }` で取得した結果と型が不一致。

```ts
// 生成側
type StoreWithIncludes = PartialBy<
  Prisma.StoreGetPayload<{ include: { admins, users, bookings, ... } }>,
  keyof typeof includeStore['include']
>;

// 使用側(現実)
const store = await prisma.store.findUnique({
  where: { id },
  select: { id: true, name: true, googleCalendarId: true }
});
// → StoreWithIncludes と型互換なし
```

結果: 使用側は `Prisma.*GetPayload<...>` を手書きし、生成モデルを使わなくなる(例: `User.repository.ts` で `UserModel` 完全無視)。

### 2. 1 モデル = 1 DTO 形状の制約

同一モデルに対し用途別の複数 DTO が必要:

- `LessonDetail`: 詳細画面用、students/instructor を展開
- `LessonListItem`: 一覧用、store 最小情報のみ

生成モデルは 1 形状しか持てず、ビュー型は手書き継続。

### 3. 関連の加工変換の不在

- `attendance === 'ABSENT' → 'お休み'` のような enum→label 変換
- `startDateTime = ${date}T${time}:00+09:00` のような派生フィールド

モデル層に入れると DB 型と混ざる。別層の手書きマッパー(例: `buildCalendarPayload.ts`)が必要。

## 解決アプローチ

**spec ファイル + アノテーション併用**。複雑/横断は spec、局所は annotation。

### 設計方針

| 用途                                            | 主な記述場所     |
| ----------------------------------------------- | ---------------- |
| フィールド単位の単純修飾(hide, simple enum map) | annotation       |
| view 定義(select + transform + computed)        | spec             |
| 複雑な派生フィールド                            | spec(関数で記述) |

衝突時: **spec > annotation**(明示上書き)

## spec ファイル案

```ts
// prisma/dto.spec.ts
import { defineViews } from "frourio-framework-prisma-generators/spec";

export default defineViews({
  Lesson: {
    detail: {
      select: {
        id: true,
        date: true,
        time: true,
        note: true,
        googleEventId: true,
        store: { select: { id: true, name: true, googleCalendarId: true } },
        instructor: { select: { id: true, name: true } },
        students: {
          select: {
            id: true,
            attendance: true,
            note: true,
            user: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      transforms: {
        "students.attendance": (v) => (v === "ABSENT" ? "お休み" : "予定"),
      },
      computed: {
        startDateTime: {
          type: "string",
          from: (row) => `${row.date}T${row.time}:00+09:00`,
        },
        endDateTime: {
          type: "string",
          from: (row) =>
            new Date(
              new Date(`${row.date}T${row.time}:00+09:00`).getTime() +
                90 * 60 * 1000,
            ).toISOString(),
        },
      },
    },

    listItem: {
      select: {
        id: true,
        date: true,
        time: true,
        store: { select: { id: true, name: true } },
      },
    },
  },

  User: {
    customer: {
      select: {
        id: true,
        studentNumber: true,
        name: true,
        nameKana: true,
        // ...
        store: { select: { id: true, name: true } },
      },
    },
  },
});
```

### Prisma generator block

```prisma
generator dto {
  provider = "frourio-framework-prisma-model-generator"
  spec     = "../prisma/dto.spec.ts"
}
```

spec 未指定なら annotation のみモード(後方互換)。

## 生成物

各 view ごとに以下を生成:

```ts
// __generated__/views/Lesson.views.ts
import type { Prisma } from "@prisma/client";

// --- detail view ---
export const lessonDetailSelect = {
  id: true,
  date: true /* ... */,
  store: { select: { id: true, name: true, googleCalendarId: true } },
  /* ... */
} as const satisfies Prisma.LessonSelect;

export type LessonDetailView = Prisma.LessonGetPayload<{
  select: typeof lessonDetailSelect;
}>;

export type LessonDetailDto = {
  id: number;
  date: string;
  // ...
  store: { id: number; name: string; googleCalendarId: string | null };
  instructor: { id: number; name: string } | null;
  students: Array<{
    id: number;
    attendance: "予定" | "お休み"; // transform 適用後の型
    note: string | null;
    user: { id: number; name: string };
    course: { id: number; name: string };
  }>;
  startDateTime: string; // computed
  endDateTime: string; // computed
};

export function toLessonDetailDto(v: LessonDetailView): LessonDetailDto {
  return {
    id: v.id,
    date: v.date,
    // ...
    store: v.store,
    instructor: v.instructor,
    students: v.students.map((s) => ({
      ...s,
      attendance: s.attendance === "ABSENT" ? "お休み" : "予定",
    })),
    startDateTime: `${v.date}T${v.time}:00+09:00`,
    endDateTime: new Date(
      new Date(`${v.date}T${v.time}:00+09:00`).getTime() + 90 * 60 * 1000,
    ).toISOString(),
  };
}

// --- listItem view ---
export const lessonListItemSelect = {
  /* ... */
} as const satisfies Prisma.LessonSelect;
export type LessonListItemView = Prisma.LessonGetPayload<{
  select: typeof lessonListItemSelect;
}>;
export type LessonListItemDto = {
  /* ... */
};
export function toLessonListItemDto(v: LessonListItemView): LessonListItemDto {
  /* ... */
}
```

## Repository 連携

生成 Repository は view ごとのメソッドを自動追加:

```ts
class GeneratedLessonRepository {
  // 既存 (v7)
  findById(id: number): Promise<LessonModel | null>;
  paginate(args): Promise<Paginated<LessonModel>>;

  // v8 追加
  findByIdDetail(id: number): Promise<LessonDetailDto | null>;
  findManyDetail(args): Promise<LessonDetailDto[]>;

  paginateListItem(args): Promise<Paginated<LessonListItemDto>>;
  findManyListItem(args): Promise<LessonListItemDto[]>;
}
```

- `findById{View}` = `prisma.*.findUnique({ where: { id }, select: ...Select })` + マッパー適用
- `findMany{View}` / `paginate{View}` 同様
- view 単位で Repo メソッド自動生成 → 使用側の手書きマッパー/include 定義が不要

## 複雑 view の扱い(逃げ道)

spec DSL で表現しきれないケース(動的 where、条件付き select) 用に raw エスケープ:

```ts
Lesson: {
  detail: {
    raw: (prisma, args) => prisma.lesson.findUnique({
      where: { id: args.id },
      select: { /* ... */ },
    }),
    map: (row) => ({ /* 手動変換 */ }),
  },
}
```

型は戻り値から推論、マッパーは使用側で書く。Repo メソッドとしては統一的に生える。

## アノテーション併用

局所的な単純修飾は Prisma スキーマ側 annotation で:

```prisma
model User {
  password String  /// @dto.hide         — 全 view の DTO から除外
  role     Role    /// @dto.map("role", { ADMIN: "管理者", USER: "ユーザー" })
}
```

spec の view 内で当該フィールドに触ると annotation 適用済み型で補完される。view 側で再定義すれば spec が勝つ。

## 実装フェーズ

### Phase 1 — spec DSL core (MVP)

- [ ] `defineViews` ランタイム(薄いパススルー関数)
- [ ] Prisma generator block で `spec` オプション受付
- [ ] spec ファイルを `jiti` 等で読込
- [ ] 静的 select のみ対応(transform/computed なし)
- [ ] `<Model>.views.ts` に `<view>Select`, `<view>View`, `<view>Dto`, `to<View>Dto` 生成
- [ ] Repository への `findById{View}` / `findMany{View}` / `paginate{View}` 自動追加
- [ ] 既存 v7 生成物と共存(default model/repo はそのまま)

### Phase 2 — transforms

- [ ] `transforms: { 'path.to.field': (v) => ... }` 対応
- [ ] パス指定でネスト relation のフィールドも変換可能
- [ ] transform 適用後の DTO 型を推論(戻り値型から)
- [ ] 静的マップ糖衣: `transforms: { 'students.attendance': { ABSENT: 'お休み', SCHEDULED: '予定' } }`

### Phase 3 — computed

- [ ] `computed: { name: { type, from } }` 対応
- [ ] `type` で TS 型指定、`from(row)` で値計算
- [ ] 非同期 computed は非対応(パフォーマンス制御不能のため)

### Phase 4 — annotation 拡張

- [ ] `@dto.hide` — DTO から除外
- [ ] `@dto.map(enumName, mapping)` — enum→label 宣言的マップ
- [ ] spec より弱い優先度で適用

### Phase 5 — raw エスケープ

- [ ] `raw: (prisma, args) => Promise<...>` + `map: (row) => Dto` 対応
- [ ] 型は戻り値推論、Repo メソッドとして統一化

### Phase 6 — DX

- [ ] spec 型補完を Prisma モデル名/フィールド名で効かせる(型レベル制約)
- [ ] spec でスキーマに無いフィールド参照 → コンパイルエラー
- [ ] 生成ファイルに元 spec の行参照コメント
- [ ] `index.ts` の barrel に views も含める

## 技術的チャレンジ

### マッパー自動生成

- 再帰 select 解析、Date/Decimal/BigInt → string 直列化
- nullable / optional の判定(`?` vs `| null`)
- transform/computed の合成

### 型と値の整合

- `as const satisfies Prisma.*Select` で select 値と型導出を同時に
- `Prisma.*GetPayload<{ select: typeof xxxSelect }>` で View 型自動導出
- DTO 型は View 型を変換した独立型として生成

### spec の型補完

- `defineViews<T extends ViewsSpec>(spec: T): T` だけだと弱い
- 完全補完には `Prisma.ModelName` / `Prisma.*Select` を参照した再帰型が必要
- 妥協: 初回生成で `spec.types.d.ts` 吐き、spec 側から import(Prisma generate と同様のパターン)

### ネスト view 参照(将来)

- `store: { $view: "Store.listItem" }` で別 view を再利用可能にしたい
- Phase 1 ではスコープ外

## 現プロジェクト(ga-programming-automation)への移行イメージ

v8 導入後の repository 例:

```ts
// backend-api/domain/lesson/repository/prisma/Lesson.repository.ts
import { LessonRepository as GeneratedLessonRepository } from "$/database/prisma/__generated__/repository/Lesson.repository";

export class LessonRepository extends GeneratedLessonRepository {
  // findByIdDetail / findManyListItem / paginateListItem は自動生成済み
  // カスタムのみ追加
  async findReminderTargets(args: { date: string }) {
    // spec で別 view 定義 or 独自クエリ
  }
}
```

- `lessonDetailInclude` / `toLessonDetail` = 自動生成に置換、削除
- `buildCalendarPayload` の大部分 = `computed` で吸収(`startDateTime`/`endDateTime`/`description`)
- UseCase は `lessonRepo.findByIdDetail(id)` → `LessonDetailDto` 直接受取

## Open Questions

- [ ] spec ファイルのフォーマット: TS のみ? YAML/TOML も? → TS 推奨(型補完が最大の利点)
- [ ] Prisma Client 側の型変更への追随方針(generate 順序)
- [ ] `transforms` で型が変わる場合、関連 view の型をどう再導出するか
- [ ] v7 annotation (`@json`, `@dto(nested: true)` 等) との統合 — Phase 4 で整理
- [ ] モノレポ環境での spec パス解決(絶対/相対)
- [ ] 巨大 schema で spec がファット化したとき、ファイル分割戦略 — `defineViews` を複数ファイルで宣言 → ジェネレータ側でマージ
