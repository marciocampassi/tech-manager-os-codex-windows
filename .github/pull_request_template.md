# Story {N.N} — {Story Title}

> _Refs: `docs/stories/{N.N}.{slug}.story.md` · `docs/qa/gates/{N.N}-{slug}.yml`_

## What was implemented

<!-- Use @dev *explain output as a starting point — 1-2 sentences is fine -->

---

## Pre-PR Checklist

### BMAD Process
- [ ] `@sm *draft {N.N}` — story drafted and reviewed
- [ ] Story status set to `Approved` before dev started
- [ ] `@dev *develop-story {N.N}` — all task checkboxes are `[x]`
- [ ] Dev Agent Record complete (Model, Completion Notes, File List)
- [ ] `@qa *review {N.N}` — QA gate is **PASS**
- [ ] `@dev *review-qa {N.N}` — QA fixes applied (if gate was CONCERNS/FAIL)
- [ ] QA re-reviewed and gate confirmed **PASS** (if fixes were needed)
- [ ] Story status set to `Done`

### Code
- [ ] `npm run lint` → 0 errors
- [ ] `npm test` → all green
- [ ] `npm run build` → clean
- [ ] `npx tsc --noEmit` → 0 type errors
- [ ] No `console.log` or debug code left in `src/`
- [ ] No secrets / API keys hardcoded

### Git hygiene
- [ ] Branch name: `story/{N.N}-{slug}` (e.g. `story/1.2-cli-framework`)
- [ ] `dist/` not committed
- [ ] `node_modules/` not committed
- [ ] Story file List matches files actually changed in this PR

---

## Test output

```
npm run lint   →
npm test       →
npm run build  →
```
