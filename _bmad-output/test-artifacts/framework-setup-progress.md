---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework']
lastStep: 'step-02-select-framework'
lastSaved: '2026-04-27'
---

# Test Framework Setup — Progress

## Step 1: Preflight Results

### Stack Detection

- **Config `test_stack_type`**: `auto` → running auto-detection
- **Frontend indicators checked**: `package.json` present — no React/Vue/Angular/Next dependencies, no `playwright.config.*`, no `vite.config.*`, no `webpack.config.*`
- **Backend indicators checked**: No `pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `*.csproj`, `Gemfile`, `Cargo.toml`
- **Detected stack**: `backend` (Node.js/TypeScript CLI — no browser front-end, no traditional backend manifest)
  - Runtime: Node.js ≥ 18 (ESM, `"type": "module"`)
  - Language: TypeScript ^5.9.3

### Prerequisites

- [x] `package.json` exists
- [x] No existing E2E framework config (`playwright.config.*`, `cypress.config.*`)
- [x] Project manifest readable

### Project Context

| Item | Value |
|------|-------|
| Project | `@marlonvidal/tech-manager-os` — AI-powered CLI for engineering managers |
| Runtime | Node.js ≥ 18.0.0, ESM (`"type": "module"`) |
| Language | TypeScript ^5.9.3 (strict mode) |
| CLI Framework | Commander.js ^14.0.3 |
| Existing tests | Jest ^29.7.0 + ts-jest (unit + integration, ESM mode) |
| Test runner script | `NODE_OPTIONS=--experimental-vm-modules jest` |
| Coverage thresholds | Branches 60%, Functions/Lines/Statements 78% |
| Test dirs | `tests/commands/`, `tests/services/`, `tests/providers/`, `tests/integration/` |
| Architecture docs | `project-context.md` loaded |

---

## Step 2: Framework Selection

### Decision

**Framework: Playwright (`@playwright/test`)**

**Rationale:**

This is a Node.js/TypeScript project with `tea_use_playwright_utils: true` in config. While no browser automation is needed for a CLI tool, `@playwright/test` is selected as the E2E test runner for the following reasons:

1. **TEA config directive**: `tea_use_playwright_utils: true` explicitly opts in to the Playwright ecosystem
2. **Superior fixture system**: Playwright's `mergeTests` fixture composition is ideal for CLI process setup/teardown (spawn/kill, temp dirs, env isolation)
3. **Parallelism & retries**: Built-in shard support and retry logic for flaky CLI integration tests — better than Jest for E2E scenarios
4. **Rich reporting**: HTML + JUnit reporters out of the box; Jest's coverage still covers unit layer
5. **TypeScript-native**: First-class TS support with no extra configuration
6. **API-testing mode**: Playwright's `APIRequestContext` can be repurposed as a typed HTTP client if any REST endpoints or process pipes are added later

**Execution boundary**: Playwright handles **E2E/integration layer** (CLI process spawning via `execa`/`child_process`). Existing Jest + ts-jest remains for **unit tests**. No browser context will be used.

**Execution mode** (resolved from config): `auto` → `sequential` (capability probe: subagent mode available but sequential chosen for deterministic output).
