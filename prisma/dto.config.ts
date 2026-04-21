import { registerModelDtos, defineModelDto } from "../src/spec";

export default registerModelDtos([
  // -------------------------------------------------------------------------
  // base: スキーマ全フィールドに対するデフォルト設定
  // views: 用途別クエリ形状の定義
  // -------------------------------------------------------------------------

  defineModelDto("User", {
    // base = 全フィールド取得時のDTO設定
    base: {
      fields: {
        // パターン1: フィールドをDTOから除外
        password: { hide: true },

        // パターン2: リレーションをXxxModelDtoとして展開（循環参照に注意）
        posts: { nested: true },
      },
      // パターン3: フィールドサブセット型を追加生成
      //   → UserPublicDto / toPublicDto()
      //   → UserAdminDto  / toAdminDto()
      profiles: [
        { name: "Public", pick: ["id", "email", "name"] },
        { name: "Admin", omit: ["password"] },
      ],
    },

    views: {
      // パターン4: シンプルなselect view
      listItem: {
        select: { id: true, email: true, name: true },
      },

      // パターン5: ネストされたリレーションを含むview
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
    },
  }),

  defineModelDto("Post", {
    views: {
      // パターン6: 計算フィールド（computed）
      //   → DBにない仮想プロパティをDTOに追加
      detail: {
        select: {
          id: true,
          title: true,
          content: true,
          published: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
        computed: {
          summary: {
            from: (v) => `${v.title} (${v.published ? "公開" : "非公開"})`,
          },
        },
      },

      // パターン7: フィールドtransform（関数）
      //   → DBの値を変換してDTOに渡す
      adminListItem: {
        select: {
          id: true,
          title: true,
          published: true,
          viewCount: true,
          createdAt: true,
        },
        transforms: {
          // published: boolean → "公開" | "非公開"（v は boolean と推論される）
          published: (v) => (v ? "公開" : "非公開"),
        },
      },

      // パターン8: フィールドtransform（静的マップ）
      //   → enumキーをラベルに変換
      withStatus: {
        select: { id: true, status: true },
        transforms: {
          status: {
            DRAFT: "下書き",
            PUBLISHED: "公開",
            ARCHIVED: "アーカイブ",
          },
        },
      },

      // パターン9: Raw view — 任意のPrismaクエリ
      //   → select形状に縛られない集計・JOIN等
      //   → prisma: PrismaClient は型付け済み、argsは明示注釈、row は推論
      stats: {
        raw: (prisma, args: { authorId: number }) =>
          prisma.post.aggregate({
            where: { authorId: args.authorId },
            _count: { id: true },
            _sum: { viewCount: true },
          }),
        map: (row) => ({
          totalPosts: row._count.id,
          totalViews: row._sum.viewCount ?? 0,
        }),
      },
    },
  }),
]);
