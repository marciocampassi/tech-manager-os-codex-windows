---
name: tmr-project-impact
description: Detect changes in project source files and report which dependent documents are affected, with specific suggestions per document. No changes applied automatically.
---
<!-- version: 1.0.0 -->

# tmr-project-impact

Detects changes in declared source-of-truth files within a project and produces a human-readable impact report with per-document suggestions. Nothing is applied automatically — you review and decide.

## Usage

- **`/tmr-project-impact`** — run against the project in the current working directory
- **`/tmr-project-impact <project-path>`** — run against a specific project (path relative to vault root)
- **`/tmr-project-impact deps`** — interactively create `deps.yaml` for the current project
- **`/tmr-project-impact <project-path> deps`** — interactively create `deps.yaml` for a specific project

The vault root is the git repository root. All relative paths in this skill are relative to the vault root unless stated otherwise.

---

## EXECUTION

When invoked, check if the user passed the argument `deps` (in any position). If so, follow the CREATE-DEPS section. Otherwise, follow these steps in order: LOCATE, DETECT, ANALYZE, REPORT.

---

## LOCATE

### Step L1: Resolve the project path

If a `<project-path>` argument was given, use it as the project root (relative to vault root).

If no argument was given:
1. Run `git rev-parse --show-toplevel` to get the vault root
2. Run `pwd` to get the current working directory
3. Compute the relative path from vault root to cwd — this is the project path
4. If the relative path is `.` or empty (you are at the vault root), ask:
   ```
   No project path provided and you are at the vault root.
   Which project? (e.g., my-company/projects/ai-enablement):
   ```
   Wait for the user's response and use it as the project path.

Store as `PROJECT_ROOT` = `<vault-root>/<project-path>`.

### Step L2: Find and load deps.yaml

Check if `<PROJECT_ROOT>/deps.yaml` exists.

**If it does NOT exist:**
Print:
```
No deps.yaml found in <project-path>.

Options:
  a) Create deps.yaml interactively → /tmr-project-impact <project-path> deps
  b) Cancel
```
Wait for the user's response. If `a`, follow the CREATE-DEPS section. If `b` or anything else, exit.

**If it does exist:**
Read and parse `<PROJECT_ROOT>/deps.yaml`.

The format is:
```yaml
sources:
  <relative-path-from-project-root>:
    description: "<what this file contains>"
    dependents:
      - file: <relative-path-from-project-root-or-vault-root>
        derives: "<what the dependent takes from this source>"
```

Build a list: `SOURCES` = all source file paths (absolute, resolved from project root).
Build a map: `DEPENDENTS[source]` = list of `{file: <absolute-path>, derives: <string>}`.

To resolve each `file` path in a dependent entry:
- Attempt to resolve from `PROJECT_ROOT` first. If the resulting path exists, use it.
- If not found under `PROJECT_ROOT`, resolve from vault root (cross-project dependency).
- If neither resolution yields an existing file, store the `PROJECT_ROOT`-relative form anyway — the file will be flagged as `MISSING` during ANALYZE.
Store the resolved absolute path.

---

## DETECT

### Step D1: Run git diff for all declared sources

From the vault root, run:

```bash
git diff HEAD -- <source-file-1> <source-file-2> ...
```

Where each `<source-file-N>` is the path of a declared source relative to the vault root (i.e., `<project-path>/<source-relative-to-project-root>`).

Also run:
```bash
git diff HEAD --name-only -- <source-file-1> <source-file-2> ...
```
This gives the list of files that actually have changes.

### Step D2: Handle no changes

If `git diff HEAD --name-only` returns no output for the source files, print:

```
No changes detected in declared sources.

Sources checked:
  <source-file-1> (relative to project root)
  <source-file-2> (relative to project root)
  ...

Nothing to report.
```

Stop.

### Step D3: Build CHANGED_SOURCES list

`CHANGED_SOURCES` = the subset of `SOURCES` that appear in the `--name-only` output.

For each changed source, store the full diff output (from the first `git diff HEAD` call).

Print to the user (progress update, not the final report):
```
Detected changes in N source(s). Analyzing impact...
```

---

## ANALYZE

### Step A1: Read all affected dependent files

For each source in `CHANGED_SOURCES`:
  For each dependent in `DEPENDENTS[source]`:
    Read the full content of the dependent file.
    If the file does not exist, note it: `MISSING[dependent.file] = true`.

### Step A2: Generate a suggestion per dependent

For each source in `CHANGED_SOURCES`:
  For each dependent in `DEPENDENTS[source]` (where the file exists):

  You have:
  - The full diff of the source file (what changed)
  - The full content of the dependent file (current state)
  - The `derives` field (what the dependent takes from this source)

  Generate a **specific, actionable suggestion** describing what needs to change in the dependent file:
  - Quote or reference the exact section, table, list, or field that is stale
  - Describe what the new value should be, based on the diff
  - Be concrete: "Line 12 says X, should now say Y" is better than "update participant count"
  - If the change does not appear to affect the dependent's content (the derived information is unchanged), say: "No update needed — derived content appears unaffected by this change."

  Store as `SUGGESTION[source][dependent.file]`.

### Step A3: Handle missing dependent files

For any `MISSING` file, the suggestion is:
```
File not found at <path>. Cannot assess impact. Verify the path in deps.yaml is correct.
```

---

## REPORT

### Step R1: Count affected documents

`AFFECTED_COUNT` = total number of distinct dependent files across all changed sources (count each file once even if multiple sources affect it).

### Step R2: Print the impact report

Print the report in this exact format:

```
## Impact Report — YYYY-MM-DD
Project: <project-path>

### Changed sources detected (N)

─── <source-file-relative-to-project-root>
    Diff summary: <one sentence describing what changed — e.g., "3 participants removed from BA location", "date for POA session changed from 05/05 to 12/05">

─── <source-file-2> (if applicable)
    Diff summary: ...

### Affected documents (AFFECTED_COUNT)

1. <dependent-file-relative-to-project-root>
   Derives: <derives field from deps.yaml>
   Suggestion: <SUGGESTION[source][dependent.file]>

2. <next-dependent>
   Derives: ...
   Suggestion: ...

...

─── No changes applied. Review the suggestions above.
```

Rules for the report:
- Use `YYYY-MM-DD` = today's date
- Order dependent files by source (group all dependents of source 1, then source 2, etc.)
- If a dependent file is affected by multiple sources, list it once per source (repeat with different suggestion)
- For cross-project dependencies, show the path relative to the vault root prefixed with `[cross-project] `
- If a file was missing (from Step A3), show it with the "File not found" suggestion

---

## CREATE-DEPS

This section runs when the user invokes `/tmr-project-impact <project-path> deps` or chooses option `a` when deps.yaml is not found.

### Step CD1: Scan for candidate sources

Use Glob to find all files in `<PROJECT_ROOT>/**/*` that match any of:
- `*.csv`
- `*.json`
- `*.yaml` / `*.yml` (excluding deps.yaml itself)
- `*.md` files whose content contains a markdown table (scan first 100 lines for `| --- |` or `|---|`)

Exclude hidden files (`.DS_Store`, `.obsidian/**`, etc.) and binary files.

### Step CD2: Present candidate sources

Print:
```
Creating deps.yaml for <project-path>

Candidate source files found:

  [1] <relative-path-from-project-root>  (<file-type>)
  [2] <relative-path-from-project-root>  (<file-type>)
  ...

Which files are sources of truth that other documents depend on?
Enter numbers separated by commas, or "all":
```

Wait for the user's response. Build `SELECTED_SOURCES` list.

### Step CD3: For each selected source, collect dependents

For each source in `SELECTED_SOURCES`:

First, ask for a description:
```
Source: <source-file>
What does this file contain? (one sentence):
```

Wait. Store as `SOURCE_DESCRIPTION`.

Then, list all markdown files in the project (excluding the source itself):
```
Which documents depend on <source-file>?

  [1] <relative-path-from-project-root>
  [2] ...

Enter numbers (comma-separated), paths, or "none":
```

Wait for the user's response. Build `SELECTED_DEPENDENTS` list.

For each selected dependent, ask:
```
What does <dependent-file> derive from <source-file>?
(e.g., "participant count by location", "session dates per office"):
```

Wait. Store as `DERIVES`.

Repeat CD3 for all selected sources.

### Step CD4: Write deps.yaml

Assemble the YAML structure and write to `<PROJECT_ROOT>/deps.yaml`.

Format:
```yaml
# Dependency manifest for <project-path>
# Generated: YYYY-MM-DD
# Run /tmr-project-impact to detect changes and get impact suggestions.

sources:
  <source-relative-path>:
    description: "<SOURCE_DESCRIPTION>"
    dependents:
      - file: <dependent-relative-path>
        derives: "<DERIVES>"
```

After writing, print:
```
deps.yaml created at <project-path>/deps.yaml

Declared sources: N
Total dependencies: M

Run /tmr-project-impact <project-path> to check for changes.
```
