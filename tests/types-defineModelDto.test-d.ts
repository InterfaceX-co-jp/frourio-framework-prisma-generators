// Type-only sanity checks for defineModelDto field-name inference.
// This file is checked by `tsc --noEmit` but never imported at runtime.

import { defineModelDto } from "../src/spec/defineModelDto";
import { defineViews } from "../src/spec/defineViews";

// ─── base.fields keys must be User field names ──────────────────────────────
defineModelDto("User", {
  base: {
    fields: {
      password: { hide: true },
      posts: { nested: true },
      // @ts-expect-error — "notAField" is not a User field
      notAField: { hide: true },
    },
    profiles: [
      { name: "Public", pick: ["id", "email", "name"] },
      { name: "Admin", omit: ["password"] },
      // @ts-expect-error — "bogus" is not a User field
      { name: "Bogus", pick: ["bogus"] },
    ],
  },
});

// ─── computed.from row narrows by select (relations included) ───────────────
defineModelDto("User", {
  views: {
    detail: {
      select: {
        id: true,
        email: true,
        posts: { select: { id: true, title: true } },
      },
      computed: {
        postCount: {
          from: (row) => {
            // row.posts must be typed as { id: number; title: string }[]
            const titles: string[] = row.posts.map((p) => p.title);
            return titles.length;
          },
        },
        // Accessing a non-selected field should error
        bad: {
          // @ts-expect-error — "name" is not in select
          from: (row) => row.name,
        },
      },
    },
  },
});

// ─── transforms allow nested dot-paths under relation names ─────────────────
defineModelDto("User", {
  views: {
    list: {
      select: { id: true, posts: { select: { id: true, status: true } } },
      transforms: {
        // top-level scalar key — typed
        email: (v) => String(v),
        // nested dot-path under relation "posts" — accepted
        "posts.status": { DRAFT: "下書き", PUBLISHED: "公開" },
      },
    },
  },
});

// ─── defineViews keys constrained to Prisma.ModelName ───────────────────────
defineViews({
  User: { all: { select: { id: true } } },
  // @ts-expect-error — "NonExistent" is not a Prisma model
  NonExistent: { all: { select: { id: true } } },
});
