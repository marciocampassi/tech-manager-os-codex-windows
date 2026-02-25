# Story {N.N} — {Story Title}

> _Refs: `docs/stories/{N.N}.{slug}.story.md` · `docs/qa/gates/{N.N}-{slug}.yml`_

## What was implemented

<!-- Use @dev *explain output as a starting point — 1-2 sentences is fine -->

## Type of change

- [ ] New feature
- [ ] Bug fix
- [ ] Refactor / tech debt
- [ ] Chore / tooling

**Breaking change?** No / Yes — _(describe impact if yes)_

---

## Pre-PR Checklist

### BMAD Process
- [ ] Story drafted (`@sm *draft`) and status set to `Approved` before dev started
- [ ] `@dev *develop-story {N.N}` — all task checkboxes `[x]`, Dev Agent Record complete
- [ ] `@qa *review {N.N}` — gate is **PASS** (re-reviewed if fixes were needed)
- [ ] `@dev *review-qa {N.N}` — QA fixes applied and story status set to `Done`

### Code & quality
- [ ] `npm run validate` passes (lint + typecheck + tests + build)
- [ ] No `console.log` or debug code left in `src/`
- [ ] No secrets / API keys hardcoded

### Git hygiene
- [ ] Branch: `story/{N.N}-{slug}` (e.g. `story/1.2-cli-framework`)
- [ ] `dist/` and `node_modules/` not committed
- [ ] Story File List matches files changed in this PR

---

## Test output

```
npm run validate →
```

## Notes for reviewer

<!-- Anything that needs context, trade-offs made, or follow-up items for next stories -->
