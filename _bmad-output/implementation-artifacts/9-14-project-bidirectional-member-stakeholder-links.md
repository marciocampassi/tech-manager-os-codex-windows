# Story 9.14 — tmr project: Bidirectional Member/Stakeholder Links

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.14 |
| **Priority** | Medium |
| **Effort** | S |
| **Risk** | Low — additive writes to existing profiles; no destructive changes |

---

## Problem Statement

`tmr project link-member <email>` and `tmr project link-stakeholder <email>` write a reference into the project file, but the linked person's profile receives nothing in return. Navigating from a member or stakeholder profile to the projects they are involved in requires a manual vault search. All profiles (direct reports, company members, contractors, leadership) should receive a back-link in a `## Projects` section when they are linked to a project.

---

## Acceptance Criteria

- `tmr project link-member <email>` writes a wiki-link entry under `## Projects` in the member's profile (`my-teams/members/<email>/<email>.md` or `my-company/members/<email>/<email>.md` or `my-company/contractors/<email>/<email>.md`)
- `tmr project link-stakeholder <email>` writes a wiki-link entry under `## Projects` in the stakeholder's profile regardless of which scope it lives in (`my-leadership/`, `my-company/members/`, `my-teams/members/`)
- If the profile already has a `## Projects` section, the new entry is appended to it — the section is NOT recreated
- If the profile does not have a `## Projects` section, it is appended to the end of the file
- Duplicate entries are not written — if the project wiki-link already exists under `## Projects`, the command is a no-op for that back-link
- Profile resolution for back-link writes uses `EmailResolutionService.resolve()` — no inline path construction
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/project.service.ts` | Add `_writeProjectBackLink(email, projectName, ws)` private method; call it in `linkMember()` and `linkStakeholder()` |
| `src/utils/markdown-section.ts` | Add (or extend) `appendToSection(filePath, sectionHeading, entry)` utility — idempotent append to a named `##` section, creating the section if absent |
| `tests/services/project.service.test.ts` | Add back-link assertions for both `linkMember` and `linkStakeholder`; test append-to-existing, create-new-section, and idempotent cases |
| `tests/utils/markdown-section.test.ts` | Unit tests for `appendToSection` covering all three cases |

---

## Implementation Detail

### 1 — `appendToSection` utility (`src/utils/markdown-section.ts`)

This utility handles the three back-link write scenarios in a single reusable function:

```typescript
/**
 * Appends `entry` under the `## {sectionHeading}` section of `filePath`.
 * - If the section exists and entry is already present: no-op.
 * - If the section exists and entry is absent: appends after the last line of the section.
 * - If the section does not exist: appends `\n## {sectionHeading}\n\n{entry}\n` to the file.
 */
export async function appendToSection(
  filePath: string,
  sectionHeading: string,
  entry: string,
  fs: FileSystemService,
): Promise<void> {
  const content = await fs.readFile(filePath);
  const sectionMarker = `## ${sectionHeading}`;

  // Idempotency check
  if (content.includes(entry)) return;

  if (content.includes(sectionMarker)) {
    // Section exists — find its end (next ## heading or EOF) and insert before it
    const lines = content.split('\n');
    const sectionStart = lines.findIndex((l) => l.trim() === sectionMarker);
    let insertAt = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        insertAt = i;
        break;
      }
    }
    lines.splice(insertAt, 0, entry);
    await fs.writeFile(filePath, lines.join('\n'));
  } else {
    // Section absent — append to EOF
    const suffix = `\n## ${sectionHeading}\n\n${entry}\n`;
    await fs.writeFile(filePath, content.trimEnd() + suffix);
  }
}
```

### 2 — `_writeProjectBackLink` in `ProjectService`

```typescript
private async _writeProjectBackLink(
  email: string,
  projectName: string,
  ws: string,
): Promise<void> {
  const resolved = await this._emailResolution.resolve(email, ws);
  if (!resolved) return; // entity not found — skip silently (link-member already validates)

  const projectOverviewPath = projectOverviewFilePath(ws, projectName); // existing helper
  const wikiLink = formatWikiLink(projectOverviewPath, resolved.profilePath, projectName);
  const entry = `- ${wikiLink}`;

  await appendToSection(resolved.profilePath, 'Projects', entry, this._fs);
}
```

### 3 — Call site in `linkMember()` and `linkStakeholder()`

After the existing project-file write in each method, add:

```typescript
await this._writeProjectBackLink(email, name, ws);
```

Both methods already resolve and validate the email before reaching this point, so no additional guard is needed.

---

## Notes for Developer Agent

- `appendToSection` must be tested in isolation — cover: section exists with entry already present (no-op), section exists without entry (append), section absent (create + append).
- The `resolved.profilePath` from `EmailResolutionService.resolve()` is the absolute path to the profile file — pass it directly to `formatWikiLink` as both the `resolvedPath` and `fromPath` argument basis.
- Do NOT use `findMemberGlobally()` or `createMember()` — both are deleted. Use `EmailResolutionService.resolve()` exclusively.
- `## Projects` is the exact section heading — case-sensitive match.
- Run `npm run validate` before marking done.
