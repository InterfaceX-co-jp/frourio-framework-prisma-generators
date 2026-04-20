import { defineViews } from "frourio-framework-prisma-generators/spec";

export default defineViews({
  User: {
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

  Post: {
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
      // Phase 2: static map sugar — published bool already handled by type,
      // but demonstrates the pattern with a hypothetical status field.
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
});
