# Performance Guide

This document describes the performance characteristics of `tech-manager-os` (`tmr`), the optimization techniques applied, and instructions for re-running benchmarks.

---

## 1. CLI Command Startup Times

### Measurement Methodology

Benchmarks are measured as **wall-clock time** from process launch to exit, using `python3 -c "import subprocess, time; ..."` with 3-run averages to account for OS file-cache warmup.

```bash
# Reproduce benchmarks after building:
npm run build
python3 -c "
import subprocess, time

cmds = [
  ['node', 'dist/cli.js', '--version'],
  ['node', 'dist/cli.js', '--help'],
  ['node', 'dist/cli.js', 'team', 'list', '--plain'],
  ['node', 'dist/cli.js', 'project', 'list', '--plain'],
  ['node', 'dist/cli.js', 'leadership', 'list', '--plain'],
]

for cmd in cmds:
  times = []
  for _ in range(3):
    start = time.time()
    subprocess.run(cmd, capture_output=True)
    elapsed = (time.time() - start) * 1000
    times.append(elapsed)
  avg = sum(times) / len(times)
  print(f'{chr(32).join(cmd[1:])}: {avg:.0f}ms avg ({min(times):.0f}ms min)')
"
```

### Baseline Results (macOS, Node.js 20.17.0 LTS, Apple Silicon)

| Command | Avg (ms) | Min (ms) | Target |
|---------|----------|----------|--------|
| `tmr --version` | 203 | 192 | <100ms |
| `tmr --help` | 194 | 192 | <100ms |
| `tmr team list` | 193 | 191 | <100ms |
| `tmr project list` | 194 | 191 | <100ms |
| `tmr leadership list` | 192 | 191 | <100ms |

### Analysis

The <100ms target is aspirational for this Node.js ESM CLI. Profiling shows:

- **Node.js process startup**: ~26ms (irreducible — bare `node` with empty script)
- **ESM module graph loading**: ~166ms for the CLI's static command module set
- **Actual business logic** (file reads, format, output): <5ms

The 192ms floor is the cost of the Node.js ESM module system loading the static command modules (config, team, member, project, leadership, task-view) and the Commander.js framework. This is comparable to other Node.js CLIs of similar scope (e.g., `npm --version` is ~200ms on the same machine).

### Optimizations Applied (Story 5.3)

The following optimization was implemented to minimize unnecessary startup cost:

**Code splitting + lazy loading of heavy commands** — `tsup` is configured with `splitting: true`. Heavy commands that load AI SDKs, `inquirer`, `googleapis`, or `chokidar` are now dynamically imported (`await import(...)`) only when actually invoked:

| Command | Deps loaded at startup (before) | Deps loaded at startup (after) |
|---------|----------------------------------|-------------------------------|
| `tmr init` | ✓ boxen + inquirer + googleapis chain | ✗ deferred |
| `tmr process` | ✓ openai + @anthropic-ai/sdk + all services | ✗ deferred |
| `tmr watch` | ✓ chokidar + all process deps | ✗ deferred |
| `tmr install` | ✓ SkillRegistryService + node:https | ✗ deferred |
| `tmr update` | ✓ same as install | ✗ deferred |

**Bundle size reduction**: Main `cli.js` dropped from **170KB** (single-bundle) to **54KB** (lazy-split entry).

### Future Directions

If strict <100ms startup is required:
1. **Output CommonJS format** — CJS `require()` loads faster than ESM `import` for this bundle size
2. **Use Bun** as the runtime — native module loading is ~5× faster than Node.js ESM
3. **Native compilation** via `pkg` or `nexe` — bundles Node.js + CLI into a single self-contained binary (~10-20ms startup)

---

## 2. `tmr process` Scalability

### Design

`tmr process` processes inbox files in a **sequential pipeline**:

1. Scan inbox (single `fs.readdir` call — O(1))
2. Load context (member + project files — O(1), called once)
3. Categorize each file via AI (O(n × AI_latency) — network-bound, not CPU-bound)
4. Update contexts (O(n) file writes, fast)
5. Extract tasks via AI (O(1) — one call for all files)
6. Organize files (O(n) file moves, fast)

**The non-AI pipeline is O(n)** with no hidden quadratic behavior. Context is loaded once (step 2) and reused across all categorization calls. There is no per-file context reload.

### Test Evidence

The scalability test (`tests/services/inbox-process.service.scalability.test.ts`) verifies:

- 25 files processed successfully (all scanned, categorized, organized)
- `categorize` called exactly 25 times (one per file — no extra calls)
- `organizeFile` called exactly 25 times  
- Complete mocked pipeline finishes in **<2000ms** (typically <50ms with mocked deps)
- Dry-run correctly skips task extraction and file organization

Run it: `npm test -- --testPathPattern inbox-process.service.scalability`

### Expected Production Timing (20+ files)

With real AI calls, `tmr process` timing for 20 files is approximately:

| Phase | Estimated time |
|-------|---------------|
| Scan + context load | <500ms (file I/O) |
| Categorize 20 files (AI) | 60–120 seconds (3–6s per call) |
| Context updates | <1s (file writes) |
| Task extraction (AI) | 10–30 seconds (one call) |
| File organization | <1s (file moves) |

AI latency dominates. The non-AI phases add negligible overhead regardless of file count.

---

## 3. Atomic File Operations

All `FileSystemService.writeFile()` calls use a **write-to-temp-then-rename** pattern for atomicity:

```typescript
// src/services/file-system.service.ts — writeFile()
async writeFile(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(tmpPath, content, 'utf8');
    await fs.rename(tmpPath, filePath);  // POSIX rename: atomic on same filesystem
  } catch (err) {
    await fs.remove(tmpPath).catch(() => {});
    throw new FileSystemError(/* ... */);
  }
}
```

**Why this is atomic**: On POSIX systems (Linux, macOS), `rename(2)` is atomic — a reader either sees the old file or the new complete file; partial writes are never observable. The temp file uses `process.pid` in its name to prevent collisions when multiple `tmr` processes run concurrently.

**File moves** use `fs.move()` from `fs-extra`, which reduces to `fs.rename()` when source and destination are on the same filesystem (the common case for vault operations).

---

## 4. AI Retry Policy

`BaseAIProvider.withRetry()` implements exponential backoff for transient AI API failures:

| Attempt | Delay before retry |
|---------|--------------------|
| 1st retry | 1s |
| 2nd retry | 2s |
| 3rd retry | 4s |
| 4th retry | 8s |
| 5th retry | 16s (cap) |
| After 5th retry | Error propagated |

**Retryable status codes**: HTTP 429 (rate limit), HTTP 5xx (server errors, including 529 — Claude overloaded).

**Non-retryable**: HTTP 401 (invalid API key), HTTP 400, other 4xx client errors.

**Configuration** (`src/providers/base-ai-provider.ts`):

```typescript
protected async withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!this.isRetryable(err) || attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 16_000);
      await this.sleep(delay);
    }
  }
  throw new Error('withRetry: exhausted all attempts');
}
```

---

## 5. Progress Indicators

Long-running operations display live progress via `ora` spinners (v9.x):

| Step | Duration | Indicator |
|------|----------|-----------|
| Scan inbox | <500ms | Plain `●` marker |
| Load context | <500ms | Plain `●` marker |
| Categorize files | 3–6s per file (AI) | `ora` spinner with per-file counter: `Categorizing meeting.md (3/10)…` |
| Extract tasks | 10–30s (AI) | `ora` spinner |
| Organize files | <500ms | Plain `●` marker |

In `--plain` mode, spinners are replaced with plain `process.stdout.write` lines (no ANSI codes).

---

## 6. Benchmark Methodology Summary

| What | How |
|------|-----|
| CLI startup times | Python `subprocess` + `time.time()`, 3-run average, `--plain` flag |
| Scalability | Jest test with 25 mocked files + `Date.now()` elapsed check |
| Atomicity | Code review of `FileSystemService.writeFile` (static analysis) |
| Retry policy | Unit tests in `tests/providers/base-ai-provider.test.ts` |

To re-run all performance-related tests:
```bash
npm test -- --testPathPattern "base-ai-provider|inbox-process.service.scalability"
```
