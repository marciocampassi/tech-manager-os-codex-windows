# Story 9.3 — my-career Flat File Structure

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.3 |
| **Priority** | High — prerequisite for correct self-profile resolution |
| **Effort** | XS |
| **Risk** | Low — beta project, no migration required |

---

## Problem Statement

`my-career/` currently uses a nested folder pattern (`my-career/<email>/<email>.md`) inconsistent with the decision that self is a single flat profile. The folder adds no value — there is always exactly one self profile and it needs no dated subdirectories. `InitService.writeUserProfile()`, `EmailResolutionService._doResolve()` step 2.5, and `MemberService._resolveManagerLink()` all contain TODOs from Story 9.1 pointing here.

No migration is required — the project is in beta.

---

## Acceptance Criteria

- `tmr init` writes the user profile to `my-career/<email>.md` (flat, no subdirectory)
- `EmailResolutionService.resolve()` returns `type: 'self'` when given the user's own email, resolving to `my-career/<email>.md`
- `MemberService._resolveManagerLink()` correctly generates a wiki-link pointing to `my-career/<email>.md`
- No `my-career/<email>/` directory is created anywhere in the codebase
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/init.service.ts` | `writeUserProfile()` — write flat `my-career/<email>.md`; remove `createDirectory()` call for the email subdirectory |
| `src/services/email-resolution.service.ts` | `_doResolve()` step 2.5 — update self-profile path; remove TODO comment |
| `src/services/member.service.ts` | `_resolveManagerLink()` — scan `my-career/` for `.md` files instead of subdirectories; remove TODO comment |
| `src/types/email-resolution.types.ts` | Update JSDoc to reflect `my-career/<email>.md` (no subfolder) |
| `tests/services/init.service.test.ts` | Update profile path assertions from nested to flat |
| `tests/services/email-resolution.service.test.ts` | Update self-resolution test fixture to flat path |
| `tests/services/member.service.test.ts` | Update `_resolveManagerLink` test fixtures to flat path |

---

## Implementation Detail

### 1 — `InitService.writeUserProfile()`

**Before:**
```typescript
const dir = path.join(vaultPath, 'my-career', email);
const filePath = path.join(dir, `${email}.md`);
// ...
await this._fs.createDirectory(dir);
await this._fs.writeFile(filePath, content);
```

**After:**
```typescript
const filePath = path.join(vaultPath, 'my-career', `${email}.md`);
// ...
// No createDirectory needed — my-career/ is created by scaffold()
await this._fs.writeFile(filePath, content);
```

The `my-career/` directory is already created by `scaffold()` via `VAULT_DIRS`. No additional directory creation is needed.

### 2 — `EmailResolutionService._doResolve()` step 2.5

**Before:**
```typescript
// 2.5. Self
const selfProfile = path.join(ws, 'my-career', email, `${email}.md`);
// TODO(Story 9.3): update self-profile path...
```

**After:**
```typescript
// 2.5. Self
const selfProfile = path.join(ws, 'my-career', `${email}.md`);
if (await this._fs.exists(selfProfile)) {
  return { type: 'self', absolutePath: selfProfile, created: false };
}
```

### 3 — `MemberService._resolveManagerLink()`

Currently scans for subdirectories under `my-career/` and constructs `my-career/<subdir>/<subdir>.md`. With the flat structure, scan for `.md` files directly:

```typescript
private async _resolveManagerLink(memberPath: string, workspaceRoot: string): Promise<string> {
  const careerRoot = path.join(workspaceRoot, 'my-career');
  if (!(await this._fs.exists(careerRoot))) return '';

  const files = await this._fs.listFiles(careerRoot);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  if (mdFiles.length === 0) return '';
  if (mdFiles.length > 1) {
    logger.warn(
      `_resolveManagerLink: found ${mdFiles.length} .md files in my-career/ — expected 1. Using "${mdFiles[0]}" as manager.`,
    );
  }

  const managerFile = mdFiles[0] as string;
  const managerProfilePath = path.join(careerRoot, managerFile);
  return formatWikiLink(managerProfilePath, memberPath, path.basename(managerFile, '.md'));
}
```

Verify `FileSystemService` exposes a `listFiles(dir)` method. If it only has `listDirectories()`, add `listFiles()` or use the underlying `fs.readdir` filtered to files.

---

## Notes for Developer Agent

- `my-career/` already exists after `scaffold()` — `writeUserProfile()` only needs `writeFile()`, no `createDirectory()`.
- The leader wiki-link inside `writeUserProfile()` computes a relative path from the self profile to the leader file. With the flat self path, recalculate: `formatWikiLink(leaderFile, filePath, leaderEmail)` where `filePath` is now `my-career/<email>.md`. Verify the relative path is still correct.
- No migration code. Beta project — old nested structure is simply abandoned.
- Run `npm run validate` before marking done.
