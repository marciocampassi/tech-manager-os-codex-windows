# High Level Architecture

## Technical Summary

Tech Leadership OS is a **local-first CLI and file system-based management workspace** built on Node.js/TypeScript. The architecture follows a **modular monolith pattern** with a command-driven interface (`tmr` CLI), local file system as the primary data store (Obsidian-compatible markdown), and AI agent orchestration powered by the BMAD Builder framework. The system integrates with multiple AI providers (OpenAI, Claude, Gemini) through a provider-agnostic abstraction layer with runtime provider switching support. Core components include: CLI command dispatcher, inbox processing engine, AI categorization service, context maintenance system, and agent orchestration. This architecture directly supports the PRD's goals of zero-latency insights, local-first privacy, and extensible agent-based intelligence while maintaining compatibility with Obsidian as the primary user interface.

## High Level Overview

**Architectural Style:** Modular Monolith with Plugin Architecture

1. **Main Architecture Style:**
   - **Modular Monolith** - Single deployable CLI application with well-defined internal modules
   - **Plugin-based extensibility** via BMAD Builder SKILL.md system
   - **Event-driven processing** for inbox monitoring and file operations
   - **Provider pattern** for AI abstraction (OpenAI/Claude/Gemini)

2. **Repository Structure:**
   - **Monorepo** - Single repository with clear module boundaries
   - Structure: `packages/cli/`, `packages/core/`, `packages/agents/`, `packages/skills/`

3. **Service Architecture:**
   - **Single-process CLI application** with modular internal architecture
   - **No distributed services** - all processing runs locally
   - **File system as database** - structured markdown files with frontmatter metadata
   - **Local-first, offline-capable** by design

4. **Primary User Interaction Flow:**
   - User drops files into `inbox/` (manually or via Granola sync)
   - User runs `tmr process` command (or invokes the `/tmr-inbox` Claude Code skill for skill-based processing)
   - AI analyzes and categorizes each file with confidence scoring
   - System updates context files, extracts tasks, routes to appropriate folders per TECH-MANAGER-OS-TEMPLATE
   - User installs additional skills via `tmr install <skill-name>` and invokes them from Claude Code

5. **Key Architectural Decisions:**
   - **Local file system over database:** Enables human readability, git versioning, Obsidian compatibility, zero vendor lock-in
   - **Append-only context updates:** O(1) AI token cost regardless of context size, user controls cleanup
   - **Confidence-gated routing:** Human-in-the-loop for ambiguous categorization decisions
   - **Single-pass AI processing:** Each transcript processed once with minimal context to control costs
   - **Email-as-identity convention:** Consistent `{email}.md` files enable Obsidian graph view resolution
   - **Multi-provider support:** Users configure their AI provider via `tmr config`; `tmr process` is the only AI-enabled CLI command
   - **Pure file system for MVP:** Rely on Obsidian's native search capabilities; defer SQLite indexing to future versions if performance requirements emerge
   - **Manual context cleanup:** Defer automated context summarization (`tmr clean-context`) to future versions; users manage file growth manually in MVP

## High Level Project Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        CLI[tmr CLI Commands]
        OBS[Obsidian Vault UI]
        GRAN[Granola Sync Plugin]
        CC[Claude Code]
    end

    subgraph "CLI Application Core"
        DISP[Command Dispatcher]
        PROC[Inbox Processor - tmr process]
        AI[AI Provider Abstraction]
    end

    subgraph "Processing Services"
        CAT[Categorization Service]
        ROUT[Routing Engine]
        CTX[Context Updater]
        TASK[Task Extractor]
    end

    subgraph "Claude Code Skills"
        INBOX_SKILL[tmr-inbox skill]
        MORE_SKILLS[... future skills]
    end

    subgraph "Storage Layer - TECH-MANAGER-OS-TEMPLATE"
        INBOX[inbox/]
        TEAMS[my-teams/members/]
        PROJECTS[my-company/projects/]
        COMPANY[my-company/members/]
        CAREER_DIR[my-career/]
        LEADERSHIP[my-leadership/]
        ARCHIVE[archive/]
        KB[knowledge-base/]
        TASKS[my-tasks/]
        CLAUDE_MD[CLAUDE.md]
    end

    subgraph "External AI Providers"
        OPENAI[OpenAI API]
        CLAUDE_API[Anthropic Claude]
        GEMINI[Google Gemini]
    end

    CLI --> DISP
    OBS --> INBOX
    GRAN --> INBOX
    CC --> INBOX_SKILL
    CC --> MORE_SKILLS

    DISP --> PROC

    PROC --> CAT
    CAT --> AI
    AI --> OPENAI
    AI --> CLAUDE_API
    AI --> GEMINI

    PROC --> ROUT
    ROUT --> CTX
    ROUT --> TASK

    INBOX_SKILL --> CLAUDE_MD
    INBOX_SKILL --> TEAMS
    INBOX_SKILL --> PROJECTS
    INBOX_SKILL --> COMPANY
    INBOX_SKILL --> TASKS

    CTX --> TEAMS
    CTX --> PROJECTS
    CTX --> CAREER_DIR

    ROUT --> TEAMS
    ROUT --> PROJECTS
    ROUT --> COMPANY
    ROUT --> LEADERSHIP
    ROUT --> ARCHIVE

    TASK --> TASKS
```

## Architectural and Design Patterns

**Key Patterns Guiding the Architecture:**

- **Command Pattern:** CLI commands encapsulated as discrete handlers with validation and execution logic - _Rationale:_ Aligns with Commander.js best practices, enables testability and extensibility

- **Strategy Pattern (AI Provider Abstraction):** Interchangeable AI provider implementations (OpenAI, Claude, Gemini) behind common interface with runtime switching - _Rationale:_ Supports BYOK requirement (FR2) and multi-provider configuration, enables easy provider switching via `tmr config set-active-provider`

- **Plugin Architecture (BMAD Skills):** SKILL.md-based extensibility for community-driven features - _Rationale:_ Core requirement for extensibility (FR8), enables community contributions without modifying core code

- **Repository Pattern (File System Access):** Abstract file system operations behind consistent API - _Rationale:_ Enables testing with in-memory filesystem, potential future migration to database if needed

- **Event-Driven Processing:** File watcher emits events for inbox changes, handlers respond asynchronously - _Rationale:_ Supports `tmr watch` requirement (FR5), decouples detection from processing

- **Confidence-Based Human-in-the-Loop:** AI decisions include confidence scores; low-confidence triggers user confirmation - _Rationale:_ Balances automation with accuracy (FR4), builds user trust over time

- **Append-Only Context Pattern:** Context files grow by appending dated entries, never require full read for updates - _Rationale:_ Keeps token costs O(1) regardless of context size (PRD brainstorm outcomes)

---
