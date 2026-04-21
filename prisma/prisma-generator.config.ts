import { registerModels, defineModel } from "../src/spec";

export default registerModels([
  defineModel("User", {
    dto: {
      fields: {
        password: { hide: true },
        posts: { nested: true },
      },
      profiles: [
        { name: "Public", pick: ["id", "email", "name"] },
        { name: "Admin", omit: ["password"] },
      ],
    },
    views: {
      /** Public profile view — safe to return from APIs. */
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
      /** Compact representation used in list endpoints. */
      listItem: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  }),

  defineModel("Post", {
    views: {
      /** Detail view for the full post page. */
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
            type: "string",
            from: (v: any) => `${v.title} (${v.published ? "公開" : "非公開"})`,
          },
        },
      },
      /** Compact row for admin list. */
      adminListItem: {
        select: {
          id: true,
          title: true,
          published: true,
          viewCount: true,
          createdAt: true,
        },
      },
    },
  }),
]);
