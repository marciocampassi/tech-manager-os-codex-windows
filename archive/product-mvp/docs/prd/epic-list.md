# Epic List

## Epic 1: Foundation & CLI Infrastructure
**Goal:** Establish TypeScript/Node.js foundation, build core CLI with Commander.js, implement configuration management with encrypted API key storage, and deliver `tmr init` with interactive leader onboarding workflow supporting multi-team structure.

## Epic 2: Complete Command-Line Interface Implementation
**Goal:** Build comprehensive CLI commands for team management (multi-team structure with email uniqueness), member file operations (1on1s, feedback, assessments, reviews), relationship tracking, leadership tracking, and project management with hierarchical email resolution and automatic wiki-link generation. All commands support both parameter and interactive modes, auto-create structures as needed, and include complete unit test coverage. This epic establishes the CRUD foundation that enables token-optimized agent implementation.

## Epic 3: Process Intelligence Engine
**Goal:** Build the AI-powered inbox processing system (`tmr process`) that scans, categorizes, and files transcripts/notes into appropriate multi-level folders (team/project/company), updates context summaries automatically using CLI commands for injection, extracts tasks, handles binary files, and provides actionable insights with Obsidian compatibility.

## Epic 4: Skills-Based Architecture Pivot
**Goal:** Re-align the product to its proven architecture: `tmr init` scaffolds the full vault structure (per TECH-MANAGER-OS-TEMPLATE) and generates a `CLAUDE.md` context file; `tmr process` routing paths are corrected to match the template and retested end-to-end; `tmr-inbox` is generalized into a distributable Claude Code skill with no hardcoded user values; a skill install/update mechanism (`tmr install` / `tmr update`) is introduced so users receive new skills over time.

## Epic 5: Polish, Testing & Distribution
**Goal:** Comprehensive testing, documentation, IDE integration validation, and npm packaging for distribution.

---
