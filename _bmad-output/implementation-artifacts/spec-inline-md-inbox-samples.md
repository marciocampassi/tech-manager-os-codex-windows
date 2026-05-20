---
title: 'Inline inbox sample files from examples/ at build time'
type: 'refactor'
created: '2026-05-15'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** `INBOX_SAMPLE_1` and `INBOX_SAMPLE_2` in `onboarding.templates.ts` were hardcoded template-literal strings that duplicated the canonical `.md` files under `examples/inbox-samples/`, creating a divergence risk on every future edit.

**Approach:** Configure tsup's esbuild `text` loader for `.md` files so the two sample files are read from disk at build time and inlined as string constants into the bundle, eliminating the duplication while keeping the published `dist/` self-contained.

## Suggested Review Order

1. [`tsup.config.ts`](../../tsup.config.ts) — one-line loader addition; confirm `.md` → `text`
2. [`src/types/md.d.ts`](../../../src/types/md.d.ts) — ambient module declaration enabling `import … from '*.md'`
3. [`src/templates/onboarding.templates.ts`](../../../src/templates/onboarding.templates.ts) — two import statements replace ~125 lines of hardcoded strings; `INBOX_SAMPLE_FILES` export unchanged
