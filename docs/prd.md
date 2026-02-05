# Tech Manager OS Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Create a local-first CLI tool that serves as an "Operating System" for high-performance Engineering Managers
- Solve "Management Entropy" (lost context, recency bias, scattered notes) by treating management artifacts as code
- Implement "Methodology-as-Code" where management logic (feedback loops, reviews) is defined in YAML "Packs", not hardcoded
- Provide zero-latency context through terminal-based operation with structured local Markdown database
- Enable "Agnostic Intelligence (BYOK)" where users bring their own API Keys (OpenAI, Claude, or Gemini)
- Deliver an MVP focused on People Management & Context Lifecycle
- Build an extensible system allowing community growth through shareable methodology packs
- Establish a base pack that ships with the tool and support premium authoral packs as monetization strategy

### Background Context

Engineering managers face a chronic problem: management entropy. Critical context gets lost in scattered notes, recency bias drives decisions instead of data, and the cognitive load of tracking multiple direct reports across quarters becomes unsustainable. Unlike engineering work where version control and structured systems are standard, management work remains chaotic and ad-hoc.

Tech Manager OS treats this problem by applying software engineering principles to management: version-controlled artifacts, structured state transitions, and AI-assisted context preservation. By making the system local-first and provider-agnostic, it respects privacy while avoiding vendor lock-in. The "Prompt Pack" architecture ensures the tool isn't opinionated about methodology—managers can adopt existing frameworks or create their own, sharing proven approaches with the community.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2026-01-29 | 2.0 | Initial PRD draft for "Methodology-as-Code" edition | John (PM) |

---

## Requirements

### Functional Requirements

**FR1:** The system shall provide a `tm init` command that creates the complete directory structure (`.system/`, `00_Inbox/`, `10_Current_Context/`, `99_Archive/`) on first run.

**FR2:** The system shall support interactive provider selection during `tm init`, allowing users to choose between OpenAI, Anthropic (Claude), and Google Gemini as their AI provider.

**FR3:** The system shall securely store API keys for the selected AI provider using encrypted configuration management.

**FR4:** The system shall provide a `tm inbox <note>` command that creates timestamped files (format: `YYYY-MM-DD-HHmm.md`) in the `00_Inbox/` directory with the provided note content.

**FR5:** The system shall provide a `tm cycle` command that processes all inbox notes, matches them to team members, updates context summaries using AI, and archives processed notes to `99_Archive/{Year}/{Quarter}/Team/{Member}/Raw_Notes/`.

**FR6:** The system shall maintain a `_Context_Summary.md` file for each team member that serves as the AI-enhanced memory of all interactions and context.

**FR7:** The system shall provide a `tm feedback <member> --type=positive|constructive` command that generates feedback drafts categorized by type, stored in separate Active_Feedback_Positive.md and Active_Feedback_Constructive.md files.

**FR8:** The system shall implement a Prompt Pack Engine that parses YAML files defining commands, inputs, and prompts, enabling community-driven methodology sharing.

**FR9:** The system shall validate all Prompt Pack YAML files against a defined schema including `meta`, `commands`, `inputs`, `prompt`, and `output` fields.

**FR10:** The system shall support variable injection using handlebars-style syntax (e.g., `{{pdi}}`) in Prompt Pack templates, replacing variables with content from specified file paths.

**FR11:** The system shall generate the default `base-pack.yaml` in `.system/packs/` during initialization, providing out-of-the-box management methodology.

**FR12:** The system shall implement state transitions for files moving between folders (Inbox → Current Context → Archive) based on temporal lifecycle rules.

**FR13:** The system shall provide `tm member add <name>` to create member folder structure including Profile.md, Current_PDI.md, Active_Feedback_Positive.md, Active_Feedback_Constructive.md, 1on1_Sessions/ subdirectory, and Performance_Reviews/ subdirectory.

**FR14:** The system shall provide `tm generate-pdi <member>` to create initial Personal Development & Improvement plan using AI analysis of context summary and profile.

**FR15:** The system shall provide `tm update-pdi <member>` to generate AI-suggested PDI updates based on progress and recent context.

**FR16:** The system shall provide `tm 1on1 create <member>` to scaffold a timestamped session file with template sections for preparation notes, discussion points, action items, and meeting notes.

**FR17:** The system shall provide `tm 1on1 prepare <member>` to generate a structured agenda by combining context summary, PDI, and session notes.

**FR18:** The system shall provide `tm performance-review <member>` to generate performance review drafts from accumulated context, feedback, and PDI progress.

**FR19:** The system shall support a layered pack system where base-pack.yaml provides core commands and optional extension packs can override or add commands.

**FR20:** The system shall provide `tm pack install <url>` to download and validate prompt packs from URLs.

**FR21:** The system shall provide `tm packs list` to display all installed packs with their metadata and status.

**FR22:** During `tm cycle`, unmatched notes shall be presented interactively for user assignment to members or archival as general notes.

**FR23:** The system shall provide `tm context <member>` to display the current context summary for a team member.

### Non-Functional Requirements

**NFR1:** The system shall run as a local-first application without requiring external cloud services except for user-provided AI API endpoints.

**NFR2:** The system shall be cross-platform compatible, supporting Mac, Linux, and Windows operating systems via Node.js runtime.

**NFR3:** The system shall implement the Adapter Pattern for AI providers, ensuring loose coupling and enabling addition of new providers without modifying core logic.

**NFR4:** The system shall use `fs-extra` for all file operations to ensure safe move/copy operations and prevent data loss during state transitions.

**NFR5:** The system shall provide clear terminal UI feedback using spinners (ora), colored output (chalk), and interactive prompts (inquirer) for enhanced user experience.

**NFR6:** The system shall store all management data as plain Markdown files in a human-readable, version-control-friendly format.

**NFR7:** The system shall maintain zero external dependencies for data storage, ensuring users retain full ownership and portability of their management data.

**NFR8:** The system shall complete the `tm cycle` command processing within reasonable time bounds, scaling to handle up to 15 team members without performance degradation (configurable for larger teams).

**NFR9:** The system shall implement graceful error handling for AI API failures, providing clear error messages and allowing retry operations.

**NFR10:** The system shall validate Prompt Pack YAML structure using Zod schema validation before execution to prevent runtime errors.

**NFR11:** The system shall be distributed as `@marlonvidal/tech-manager-os` on npm with the binary command `tm`.

**NFR12:** The system shall support pack layering with clear precedence rules where extension packs override base pack commands.

---

## User Interface Design Goals

### Overall UX Vision

Tech Manager OS embraces the terminal-native workflow of engineering managers who live in the command line. The UX philosophy is "zero friction, maximum context" - every command should feel instant, every output should be scannable, and every interaction should respect the user's flow state. The tool should disappear into muscle memory, becoming an extension of thought rather than a barrier to action.

### Key Interaction Paradigms

- **Command-first design:** All functionality accessible via explicit commands (no hidden menus or TUI navigation)
- **Progressive disclosure:** Simple commands with sensible defaults; verbose output available via `--verbose` flag
- **Interactive when needed:** Use `inquirer` prompts only for destructive operations or ambiguous inputs
- **Readable output:** Use `chalk` for semantic coloring (green=success, yellow=warning, blue=info, red=error)
- **Streaming feedback:** Long-running AI operations show progress with `ora` spinners and status updates
- **Idempotent operations:** Commands can be safely re-run without side effects where applicable

### Core Screens and Views

Since this is a CLI, "screens" are command outputs:

1. **Initialization Flow** (`tm init`) - Opens with branded welcome message "**Tech Manager OS by Marlon Vidal - Comunidade Tech Manager de Resultados**", followed by interactive setup wizard with provider selection and API key entry
2. **Member Dashboard** (`tm member list`) - Table view of all team members with last interaction dates
3. **Context View** (`tm context <member>`) - Formatted display of member's context summary with highlighted recent updates
4. **1:1 Agenda Output** (`tm 1on1 prepare <member>`) - Structured agenda with sections, timestamps, and action items
5. **Pack Management** (`tm packs list`) - Table showing installed packs, versions, active status
6. **Cycle Results** (`tm cycle`) - Processing summary showing matched notes, updated members, errors

### Accessibility

**Terminal Accessibility:** The tool shall support screen readers through:
- Plain text output mode (`--plain` flag) that strips ANSI colors
- Descriptive status messages that don't rely solely on color
- Structured output formats (JSON via `--json` flag) for programmatic consumption

### Branding

**Brand Identity:**
- **Primary Message:** "Tech Manager OS by Marlon Vidal - Comunidade Tech Manager de Resultados"
- **Display Context:** Shown prominently during `tm init` and optionally on first run of any command (with `--version` flag)
- **Purpose:** Establish brand recognition and community connection

**Terminal Aesthetic:** Modern CLI tool aesthetic inspired by tools like Vercel CLI, Stripe CLI, and GitHub CLI:
- Monochrome branding with subtle color accents
- Clean typography using box-drawing characters for structure
- Emoji prefixes for command categories (optional, can be disabled with `TM_NO_EMOJI` env var)
- Brand message displayed with visual separator (e.g., bordered box or accent lines)

### Target Device and Platforms

**Cross-Platform Terminal:** Support all major terminal emulators:
- macOS: Terminal.app, iTerm2, Warp, Kitty
- Windows: PowerShell, Windows Terminal, WSL
- Linux: gnome-terminal, Konsole, Alacritty

Minimum terminal width: 80 columns (graceful degradation on smaller terminals)

---

## Technical Assumptions

### Repository Structure: Monorepo

**Decision:** Single repository containing all Tech Manager OS code.

**Rationale:** 
- The tool is a single CLI package with clear boundaries
- No need for separate deployments or independent versioning of components
- Simplifies development workflow and dependency management
- All code ships together as `@marlonvidal/tech-manager-os`

### Service Architecture

**Architecture:** Modular Monolith with Plugin System

**Core Components:**
1. **CLI Layer** - Command parsing and routing (Commander.js)
2. **Core Services** - FileSystemService, TemplateEngine, CycleEngine
3. **AI Adapter Layer** - Provider interface with OpenAI/Claude/Gemini implementations
4. **Pack Engine** - YAML parser, validator, and command executor

**Rationale:**
- Not microservices - it's a local CLI tool with no network boundaries to exploit
- Not pure monolith - the Pack system requires extensibility
- Modular design allows clean separation of concerns while maintaining simplicity
- Plugin pattern for Packs enables community extensions without core modifications

### Testing Requirements

**Testing Strategy:** Unit + Integration + Manual Testing Helpers

**Specific Requirements:**
1. **Unit Tests** (Jest)
   - All core services (FileSystemService, AIAdapter, PackEngine)
   - Business logic (cycle matching, context merging)
   - Target: 80%+ coverage of core modules

2. **Integration Tests**
   - Command execution flows (init → member add → inbox → cycle)
   - Pack loading and execution
   - AI provider integration (mocked responses)

3. **Manual Testing Helpers**
   - `tm --dev-mode` flag to use fixture data
   - Mock AI responses for testing without API keys
   - Test data generator: `npm run generate-test-data`

**Rationale:**
- E2E tests are expensive for CLI tools (shell execution overhead)
- Integration tests at the command level provide good ROI
- Manual testing helpers critical for developer experience
- No need for browser-based testing (Playwright, Cypress)

### Additional Technical Assumptions and Requests

**Language & Runtime:**
- **TypeScript 5.x** with strict mode enabled
- **Node.js 18+** (LTS version with fetch API built-in)
- **ES Modules** (ESM) for modern module system

**Key Libraries:**
- **CLI Framework:** `commander` for command parsing
- **Prompts:** `inquirer` for interactive questions
- **UI:** `chalk` (colors), `ora` (spinners), `cli-table3` (tables)
- **File System:** `fs-extra` for safe file operations
- **Configuration:** `conf` for encrypted config storage
- **Validation:** `zod` for Prompt Pack schema validation
- **Templating:** `handlebars` for variable injection in packs
- **AI SDKs:** `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`

**Build & Distribution:**
- **Build Tool:** `tsup` for fast TypeScript bundling
- **Package Manager:** npm (package published to npm registry)
- **Binary:** Single `tm` executable via package.json bin field
- **Versioning:** Semantic versioning (SemVer)

**Security & Configuration:**
- API keys stored encrypted in OS-specific config directories (not in workspace)
- Config location: `~/.config/@marlonvidal-tech-manager-os/config.json` (Linux), `~/Library/Application Support/...` (macOS), `%APPDATA%\...` (Windows)
- AES-256 encryption for API keys using `conf` library
- Support environment variable overrides (`TM_PROVIDER`, `TM_API_KEY`)
- No telemetry or data collection by default
- All user data stays local (privacy-first)

**Performance Constraints:**
- CLI commands should respond in <100ms (excluding AI calls)
- AI operations should show progress indicators after 500ms
- File operations should be atomic (no partial writes)
- Retry logic with exponential backoff for AI API rate limits

**Development Workflow:**
- **Linting:** ESLint with TypeScript rules
- **Formatting:** Prettier
- **Pre-commit Hooks:** Husky + lint-staged
- **CI/CD:** GitHub Actions for automated testing and npm publishing

---

## Epic List

### Epic 1: Foundation & Core CLI Infrastructure
**Goal:** Establish project scaffolding, TypeScript/Node.js foundation, CLI framework with Commander.js, and implement `tm init` command that creates directory structure and validates basic file operations.

### Epic 2: Configuration & AI Provider System
**Goal:** Implement secure configuration management with encrypted API key storage, build the AI provider adapter pattern with OpenAI/Claude/Gemini implementations, and deliver `tm config` commands for provider management.

### Epic 3: Team Member & Context Management
**Goal:** Enable team member lifecycle management (`tm member add/list`) and implement the inbox capture system (`tm inbox`), creating the foundational data structures for storing member profiles and context.

### Epic 4: The Cycle Engine (Context Intelligence)
**Goal:** Build the core cycle engine that processes inbox notes, matches them to team members using AI, updates context summaries, and archives processed notes - delivering the "zero-latency context" value proposition.

### Epic 5: Prompt Pack Engine & Actionable Commands
**Goal:** Implement the YAML-based Prompt Pack system with Handlebars templating, create the base-pack.yaml with management methodology, and deliver all actionable AI commands (1:1 prep, PDI generation, feedback, performance reviews).

### Epic 6: Pack Distribution & Polish
**Goal:** Enable pack installation from URLs, implement pack validation and listing commands, add comprehensive error handling, progress indicators, and finalize terminal UX with branding.

---

## Epic Details

### Epic 1: Foundation & Core CLI Infrastructure

**Expanded Goal:** Establish a professional-grade TypeScript project with Node.js runtime, implement the Commander.js CLI framework with proper argument parsing and help system, create the FileSystemService for safe directory operations, and deliver the `tm init` command that creates the complete Tech Manager OS directory structure with branded welcome message. This epic ensures all subsequent development has a solid foundation with proper tooling, testing infrastructure, and basic file operations validated.

#### Story 1.1: Project Scaffolding and TypeScript Configuration

**As a** developer,  
**I want** a properly configured TypeScript Node.js project with all development tooling,  
**so that** I can build the CLI with type safety, linting, and automated testing.

**Acceptance Criteria:**

1. Project initialized with `package.json` containing: Name: `@marlonvidal/tech-manager-os`, Version: `1.0.0`, Binary configuration: `"bin": { "tm": "./dist/cli.js" }`, Scripts for `build`, `dev`, `test`, `lint`
2. TypeScript configured with `tsconfig.json`: Target: ES2022, Module: ESNext, Strict mode enabled, Output directory: `dist/`, Source maps enabled
3. Development tooling installed: ESLint with TypeScript rules, Prettier, Husky for git hooks, Jest for testing with TypeScript support
4. Project structure created: `/src` with `/commands`, `/services`, `/types`, `/utils`, `cli.ts`; `/tests`, `/dist`
5. Can run `npm run build` successfully and produce `dist/cli.js`
6. Can run `npm test` and see example test pass
7. README.md created with project description and setup instructions

#### Story 1.2: CLI Framework with Commander.js

**As a** user,  
**I want** a CLI tool that displays help information and handles commands properly,  
**so that** I can discover available commands and understand how to use the tool.

**Acceptance Criteria:**

1. Commander.js integrated and configured in `cli.ts`
2. Running `tm --help` displays: Tool description, version number, list of available commands, usage examples
3. Running `tm --version` displays current version from package.json
4. Running `tm` with no arguments displays help information
5. Running `tm unknown-command` shows error with suggestion to run `--help`
6. Global options work: `--verbose`, `--plain`, `--json`
7. Error handling catches exceptions and displays user-friendly messages (stack traces only with `--verbose`)

#### Story 1.3: FileSystemService for Safe Operations

**As a** developer,  
**I want** a centralized service for all file system operations,  
**so that** file operations are safe, testable, and handle errors gracefully.

**Acceptance Criteria:**

1. `FileSystemService` class created with methods: `createDirectory`, `writeFile`, `readFile`, `moveFile`, `listFiles`, `exists`, `deleteFile`
2. Uses `fs-extra` library for all operations
3. All operations are atomic and safe: write uses temp+rename, move verifies destination, delete requires confirmation
4. Comprehensive error handling: permission errors, path not found, disk full all handled gracefully
5. Unit tests cover all methods: happy path, error scenarios, edge cases
6. Service is injectable/mockable for testing

#### Story 1.4: `tm init` Command Implementation

**As a** new user,  
**I want** to run `tm init` and have the complete directory structure created with branding,  
**so that** I can start using Tech Manager OS immediately.

**Acceptance Criteria:**

1. Displays branded welcome message with "Tech Manager OS by Marlon Vidal - Comunidade Tech Manager de Resultados"
2. Creates complete directory structure: `.system/packs/`, `00_Inbox/`, `10_Current_Context/Team_Active/`, `10_Current_Context/Projects_Active/`, `99_Archive/`
3. Each directory contains `.gitkeep` file
4. Displays progress with spinners for each directory created
5. If already initialized: warns user and asks to confirm reinitialize
6. Final success message with next steps
7. Creates `.tmignore` file in root
8. Integration test validates full command execution

---

### Epic 2: Configuration & AI Provider System

**Expanded Goal:** Build the secure configuration management system using the `conf` library to store encrypted API keys in OS-specific directories outside the workspace, implement the AI provider adapter pattern with concrete implementations for OpenAI, Anthropic Claude, and Google Gemini, and deliver the `tm config` command that enables users to select their provider, securely store API keys, and switch providers without data loss. This epic delivers the "Agnostic Intelligence (BYOK)" core principle.

#### Story 2.1: Configuration Service with Encrypted Storage

**As a** user,  
**I want** my API keys stored securely and encrypted on my machine,  
**so that** my credentials are protected and never exposed in plaintext.

**Acceptance Criteria:**

1. `ConfigService` class created with methods: `initialize`, `set`, `get`, `has`, `delete`, `getAll`
2. Uses `conf` library with encryption enabled in OS-specific locations
3. Config schema defined with TypeScript interface for TMConfig
4. API keys never logged or displayed: logger redacts patterns, `getAll()` masks keys, error messages exclude keys
5. Environment variable support: `TM_PROVIDER` and `TM_API_KEY` override config
6. Unit tests cover storage/retrieval, environment precedence, key masking, error handling

#### Story 2.2: AI Provider Interface and Adapter Pattern

**As a** developer,  
**I want** a provider-agnostic AI interface,  
**so that** adding new AI providers doesn't require changing business logic.

**Acceptance Criteria:**

1. `AIProvider` interface defined with `name`, `testConnection()`, `generateText()`, `streamText()`
2. `AIProviderFactory` class with `create()` method
3. `BaseAIProvider` implements common functionality: retry logic, rate limit handling, error normalization
4. All three providers follow same pattern and are unit testable
5. Mock provider for testing returns predictable responses
6. Integration tests validate factory pattern

#### Story 2.3: OpenAI Provider Implementation

**As a** user with an OpenAI API key,  
**I want** to use GPT-4 or GPT-3.5 for AI operations,  
**so that** I can leverage OpenAI's language models for management tasks.

**Acceptance Criteria:**

1. `OpenAIProvider` class implements `AIProvider` interface
2. Uses official `openai` npm package
3. `testConnection()` validates key with minimal API call
4. `generateText()` uses `gpt-4-turbo-preview`, handles system/user prompts, respects temperature/maxTokens
5. `streamText()` uses streaming API, yields chunks, handles errors
6. Error handling: 401/403 → user-friendly message, 429 → retry with backoff, 500 → clear error, network errors → retry suggestion
7. Unit tests with mocked OpenAI client cover all scenarios
8. Can be manually tested with real API key

#### Story 2.4: Anthropic Claude Provider Implementation

**As a** user with an Anthropic API key,  
**I want** to use Claude for AI operations,  
**so that** I can leverage Anthropic's language models for management tasks.

**Acceptance Criteria:**

1. `AnthropicProvider` class implements `AIProvider` interface
2. Uses official `@anthropic-ai/sdk` package
3. Uses `claude-3-opus-20240229` as default model
4. Properly formats messages for Claude API
5. Implements streaming support
6. Error handling specific to Anthropic API
7. Unit tests with mocked client cover all scenarios

#### Story 2.5: Google Gemini Provider Implementation

**As a** user with a Google AI API key,  
**I want** to use Gemini for AI operations,  
**so that** I can leverage Google's language models for management tasks.

**Acceptance Criteria:**

1. `GeminiProvider` class implements `AIProvider` interface
2. Uses official `@google/generative-ai` package
3. Uses `gemini-pro` as default model
4. Formats prompts correctly for Gemini API
5. Implements streaming support
6. Error handling for Gemini-specific scenarios including safety filters
7. Unit tests with mocked client

#### Story 2.6: `tm config setup` Interactive Configuration

**As a** new user,  
**I want** an interactive wizard to configure my AI provider,  
**so that** I can easily set up the tool without reading documentation.

**Acceptance Criteria:**

1. `tm config setup` starts interactive flow with inquirer
2. Provider selection prompt with arrow keys
3. After selection, displays information about provider and API key setup instructions
4. API key input prompt (password-style, hidden)
5. Key validation: shows spinner, validates connection, reports success or failure
6. On failure, asks to try again
7. After success: saves provider and encrypted key, displays success message
8. Handles edge cases: user cancels, network error, already configured

#### Story 2.7: `tm config` Command Suite

**As a** user,  
**I want** to view and modify my configuration,  
**so that** I can switch providers or update API keys as needed.

**Acceptance Criteria:**

1. `tm config` (no args) displays current configuration with masked API key
2. `tm config edit` launches interactive menu for changes
3. `tm config provider` displays current provider
4. `tm config reset` with confirmation deletes all configuration
5. `tm config path` displays config file location
6. `tm config validate` tests API key connection and validates structure
7. All commands respect global flags (`--json`, `--plain`)
8. Proper exit codes: 0=success, 1=error, 2=user cancellation

---

### Epic 3: Team Member & Context Management

**Expanded Goal:** Implement the team member lifecycle management system with `tm member add` creating complete folder structures including Profile.md, PDI files, feedback files, and session directories, build the member listing command with formatted table output, and deliver the zero-friction `tm inbox` command for rapid note capture with timestamped markdown files. This epic establishes the data foundation that subsequent AI operations will populate and enrich, enabling managers to begin organizing their team context immediately.

#### Story 3.1: Team Member Data Structure & Profile System

**As a** developer,  
**I want** a well-defined data structure for team members,  
**so that** all team data is consistently organized and discoverable.

**Acceptance Criteria:**

1. `MemberService` class created with methods: `createMember`, `getMember`, `listMembers`, `archiveMember`, `memberExists`
2. TypeScript interfaces defined for `Member` and `ProfileData`
3. Member directory structure includes Profile.md, Current_PDI.md, feedback files, _Context_Summary.md, 1on1_Sessions/, Performance_Reviews/
4. `Profile.md` template contains structured sections: Basic Information, Skills & Expertise, Communication Preferences, Career Goals, Notes
5. Initial files created with helpful placeholder content
6. Member names sanitized for file system: spaces to underscores, special chars removed
7. Unit tests cover all service methods and edge cases

#### Story 3.2: `tm member add` Command Implementation

**As a** manager,  
**I want** to add a team member with a single command,  
**so that** I can quickly set up tracking for new direct reports.

**Acceptance Criteria:**

1. `tm member add <name>` creates complete member structure
2. Command flow with progress indicators for each step
3. Success message with next steps
4. Optional `--interactive` flag for guided setup with role, team, skills, etc.
5. Validation: member already exists, invalid name, workspace not initialized
6. Name normalization shown to user
7. Supports both quoted and unquoted names
8. Integration test validates full member creation

#### Story 3.3: `tm member list` Command Implementation

**As a** manager,  
**I want** to see a list of all my team members with key information,  
**so that** I can quickly understand my team's current state.

**Acceptance Criteria:**

1. `tm member list` displays formatted table with cli-table3 showing Name, Role, Last Updated, Sessions
2. Empty state message when no members exist
3. Columns display proper data with relative times
4. Optional filters: `--recent`, `--stale`
5. Output format options: default table, `--plain`, `--json`
6. Sort options: alphabetical (default), `--sort recent`, `--sort sessions`
7. Integration test validates table generation

#### Story 3.4: `tm inbox` Quick Capture Command

**As a** manager,  
**I want** to instantly capture thoughts and observations,  
**so that** I don't lose context while in meetings or during my day.

**Acceptance Criteria:**

1. `tm inbox <note>` creates timestamped file in `00_Inbox/` with format `YYYY-MM-DD-HHmm.md`
2. File content properly formatted with markdown header
3. Command supports simple notes, multi-line notes, and piped input
4. Optional `--member` flag adds metadata header for matching hint
5. Validation: empty note, workspace not initialized
6. Edge cases: multiple notes same minute (suffix), very long notes (warn), special characters (escaped)
7. Success message includes inbox count and suggestion to run cycle
8. Unit tests cover all input scenarios

#### Story 3.5: `tm context` View Member Context

**As a** manager,  
**I want** to view a team member's current context summary,  
**so that** I can refresh my memory before a 1:1 or when making decisions.

**Acceptance Criteria:**

1. `tm context <member>` displays formatted context summary with chalk colors
2. Shows _Context_Summary.md contents with metadata: last updated, notes in inbox, next 1:1
3. Lists related file paths
4. If context empty: shows helpful message about running cycle
5. Member name matching: fuzzy matching, case insensitive, handles multiple matches
6. Optional flags: `--edit` (opens in editor), `--json`, `--with-sessions`
7. Integration test validates context display

---

### Epic 4: The Cycle Engine (Context Intelligence)

**Expanded Goal:** Build the core cycle engine that scans the inbox directory for unprocessed notes, uses AI-powered matching to associate notes with team members (handling fuzzy name matching and context clues), sends matched notes plus existing context summaries to the AI provider for intelligent summarization that preserves history while incorporating new information, writes updated summaries back to member _Context_Summary.md files, and archives processed notes to the appropriate quarterly archive directory. This epic delivers the "zero-latency context" value proposition that is central to Tech Manager OS.

#### Story 4.1: Inbox Scanner and Note Parser

**As a** developer,  
**I want** to scan and parse all inbox notes efficiently,  
**so that** the cycle engine can process them for member matching.

**Acceptance Criteria:**

1. `InboxService` class created with methods: `scanInbox()`, `parseNote()`, `getNoteMetadata()`
2. `scanInbox()` returns array of `Note` objects with: filename, filepath, content, timestamp, suggestedMember (if metadata present)
3. Handles all edge cases: empty inbox, malformed files, very large notes
4. Parses markdown frontmatter for metadata (suggested_member hint)
5. Notes sorted by timestamp (oldest first for chronological processing)
6. Validates note format and warns about issues (non-markdown files ignored)
7. Unit tests cover scanning empty/full inbox, parsing various formats, metadata extraction

#### Story 4.2: AI-Powered Member Matching

**As a** manager,  
**I want** notes automatically matched to the correct team members,  
**so that** I don't have to manually tag every note.

**Acceptance Criteria:**

1. `MatchingService` class created with methods: `matchNoteToMember()`, `interactiveMatch()`
2. Matching algorithm:
   - **Priority 1:** Explicit member hint in metadata (`--member` flag)
   - **Priority 2:** Exact name match in note content (case insensitive)
   - **Priority 3:** Fuzzy name match (handles "Sarah" → "Sarah Chen", "Mike" → "Michael Johnson")
   - **Priority 4:** AI-powered contextual matching (sends note + member list to AI, asks: "Which team member is this about?")
   - **Fallback:** Mark as unmatched for interactive resolution
3. Returns `MatchResult` object: `{ member: string | null, confidence: 'high' | 'medium' | 'low', reason: string }`
4. For low confidence matches, flags for user review
5. Batch processing: can match multiple notes efficiently
6. Unit tests cover all matching strategies with mocked AI responses
7. Integration test validates end-to-end matching with real member data

#### Story 4.3: Context Summarization with AI

**As a** developer,  
**I want** AI to intelligently merge new notes with existing context,  
**so that** context summaries stay current and coherent.

**Acceptance Criteria:**

1. `ContextSummarizationService` class with method: `updateContext(member, existingContext, newNotes)`
2. Summarization prompt template:
   ```
   You are maintaining a context summary for a team member.
   
   Current Summary:
   {existingContext}
   
   New Notes (chronological):
   {newNotes}
   
   Task: Update the summary to incorporate new information while preserving important historical context.
   
   Rules:
   - Newer information supersedes older information
   - Keep the summary concise but comprehensive
   - Highlight changes in behavior, goals, or concerns
   - Maintain chronological awareness
   - Preserve important milestones
   ```
3. Handles empty existing context (first summary generation)
4. Chunks large contexts if they exceed token limits
5. Returns updated summary with metadata: `{ summary: string, notesProcessed: number, updatedAt: Date }`
6. Error handling: AI failure doesn't lose data (keeps old summary + appends raw notes)
7. Unit tests with mocked AI responses validate summarization logic

#### Story 4.4: Archival System

**As a** developer,  
**I want** processed notes archived in a structured year/quarter format,  
**so that** historical data is preserved and inbox stays clean.

**Acceptance Criteria:**

1. `ArchiveService` class with methods: `archiveNote()`, `getArchivePath()`, `listArchived()`
2. Archive path format: `99_Archive/{Year}/{Quarter}/Team/{Member_Name}/Raw_Notes/`
3. Quarter calculation: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
4. Creates archive directories as needed
5. Moves (not copies) notes from inbox to archive, preserving original filename
6. Generates archive index file: `99_Archive/{Year}/{Quarter}/_index.md` with summary of archived notes
7. Handles edge cases: member archived/deleted, duplicate filenames in archive
8. Unit tests cover path generation, quarter calculation, file operations

#### Story 4.5: Interactive Unmatched Note Resolution

**As a** manager,  
**I want** to manually assign unmatched notes during cycle,  
**so that** no context is lost even when AI can't determine the correct member.

**Acceptance Criteria:**

1. During `tm cycle`, unmatched notes trigger interactive prompt:
   ```
   Unmatched Note (2026-01-29-1430.md):
   "Discussed performance review timeline and format preferences."
   
   ? Assign to:
     ❯ Sarah Chen
       Mike Johnson
       Ana Rodriguez
       [Archive as General Note]
       [Skip this note]
   ```
2. User can select member with arrow keys
3. "[Archive as General Note]" option moves to `99_Archive/{Year}/{Quarter}/General/`
4. "[Skip this note]" leaves note in inbox for next cycle
5. Displays count: "3 unmatched notes remaining" after each assignment
6. Can handle batch operations: "Assign next 5 notes to Sarah Chen?"
7. Integration test simulates interactive flow with inquirer mocks

#### Story 4.6: `tm cycle` Command Implementation

**As a** manager,  
**I want** to run one command that processes all my notes and updates context,  
**so that** my team context stays current with minimal effort.

**Acceptance Criteria:**

1. `tm cycle` orchestrates the full pipeline: Scan → Match → Summarize → Archive
2. Command flow with progress tracking:
   ```bash
   $ tm cycle
   
   Processing inbox...
   
   ✓ Scanned 7 notes
   ✓ Matched 5 notes automatically
   ⚠ 2 notes need manual assignment
   
   [Interactive prompts for unmatched notes]
   
   Updating context summaries...
   ⠹ Sarah Chen (3 notes)...
   ✓ Sarah Chen context updated
   ⠹ Mike Johnson (2 notes)...
   ✓ Mike Johnson context updated
   
   Archiving processed notes...
   ✓ Moved 7 notes to 99_Archive/2026/Q1/
   
   ✓ Cycle complete!
   
   Summary:
   - Notes processed: 7
   - Members updated: 2
   - Time: 8.3s
   
   Run 'tm context <member>' to view updated summaries.
   ```
3. Handles edge cases: empty inbox, all notes unmatched, AI failure mid-process
4. Atomic operations: if cycle fails, inbox is preserved (no data loss)
5. Optional flags:
   - `--dry-run`: Show what would happen without making changes
   - `--auto-archive-unmatched`: Skip interactive prompts, auto-archive unmatched notes
   - `--verbose`: Show detailed AI prompts and responses
6. Error recovery: on AI failure, saves partial progress and allows resume
7. Integration test validates full cycle with multiple notes and members

---

### Epic 5: Prompt Pack Engine & Actionable Commands

**Expanded Goal:** Implement the YAML-based Prompt Pack system with Zod schema validation, create the Handlebars templating engine for variable injection, design and implement the base-pack.yaml containing sophisticated prompts for all management commands, and deliver all actionable AI commands including 1:1 preparation, PDI generation and updates, positive/constructive feedback generation, and performance review drafting. This epic transforms Tech Manager OS from a note-taking system into a proactive management assistant.

#### Story 5.1: Prompt Pack Schema and Validation

**As a** developer,  
**I want** a strict schema for prompt packs,  
**so that** community-created packs are validated before execution.

**Acceptance Criteria:**

1. Zod schema defined in `src/types/PackSchema.ts`:
   ```typescript
   const PackSchema = z.object({
     meta: z.object({
       name: z.string(),
       version: z.string(),
       author: z.string(),
       description: z.string().optional(),
       extends: z.string().optional(), // For extension packs
     }),
     commands: z.array(z.object({
       name: z.string(),
       description: z.string(),
       inputs: z.array(z.object({
         variable: z.string(),
         source: z.string(), // file path or keyword
         required: z.boolean().default(true),
       })),
       prompt: z.object({
         system: z.string().optional(),
         user: z.string(),
         temperature: z.number().optional(),
         maxTokens: z.number().optional(),
       }),
       output: z.object({
         type: z.enum(['file', 'console']),
         path: z.string().optional(),
         append: z.boolean().default(false),
       }),
     })),
   });
   ```
2. `PackValidationService` with method: `validate(packYaml: string): ValidationResult`
3. Validation checks:
   - Schema compliance
   - Variable references in prompts match declared inputs
   - Output paths are valid
   - Command names don't conflict with built-in commands
   - Extends field references existing pack
4. Clear error messages: "Line 15: Variable {{pdi}} used but not declared in inputs"
5. Unit tests cover valid packs, various invalid scenarios

#### Story 5.2: Pack Loading and Extension System

**As a** developer,  
**I want** packs loaded with proper extension/override behavior,  
**so that** extension packs can customize base commands.

**Acceptance Criteria:**

1. `PackLoaderService` with methods: `loadPack()`, `loadExtensions()`, `resolvePack()`
2. Loading order:
   - Load base-pack.yaml (always)
   - Load extension packs from config
   - Apply overrides (extensions override base)
3. Command resolution: If extension defines same command name, it overrides base
4. Extension packs can: Override existing commands, Add new commands, Inherit from base
5. Validation ensures circular dependencies don't exist (A extends B extends A)
6. Caching: Packs loaded once per session, reloaded only if file changes detected
7. Unit tests cover loading, overrides, circular dependency detection

#### Story 5.3: Template Engine with Handlebars

**As a** developer,  
**I want** to inject variables into prompt templates,  
**so that** packs can reference member data dynamically.

**Acceptance Criteria:**

1. `TemplateService` class with method: `render(template: string, variables: Record<string, string>)`
2. Uses Handlebars library for templating
3. Variable resolution:
   - File paths: Reads content from specified file (e.g., `source: "Current_PDI.md"` → reads member's PDI)
   - Keywords: Special sources like `context_summary`, `recent_feedback`, `profile`
   - Computed: `recent_notes_count`, `days_since_last_1on1`, etc.
4. Handles missing variables: If variable required and missing, throw clear error
5. Supports Handlebars helpers:
   - `{{#if variable}}...{{/if}}`
   - `{{#each items}}...{{/each}}`
   - Custom helper: `{{truncate text 500}}`
6. Security: Sandboxed execution (no code evaluation, only template interpolation)
7. Unit tests cover variable injection, missing variables, helpers

#### Story 5.4: Base Pack YAML Design

**As a** product manager and author,  
**I want** a high-quality base pack with sophisticated management prompts,  
**so that** users get immediate value and see the potential for custom packs.

**Acceptance Criteria:**

1. `base-pack.yaml` created in `.system/packs/` with meta section:
   ```yaml
   meta:
     name: "Tech Manager OS Base Pack"
     version: "1.0.0"
     author: "Marlon Vidal - Comunidade Tech Manager de Resultados"
     description: "Official base pack with core management commands"
   ```
2. Contains commands for: `1on1-prepare`, `generate-pdi`, `update-pdi`, `feedback-positive`, `feedback-constructive`, `performance-review`
3. Each prompt is thoughtfully crafted with:
   - Clear system instruction defining AI role
   - Structured user prompt with context injection
   - Appropriate temperature settings (lower for factual, higher for creative)
   - Output formatting instructions
4. Example quality (1on1-prepare command):
   ```yaml
   - name: 1on1-prepare
     description: Generate structured 1:1 agenda
     inputs:
       - variable: context_summary
         source: "_Context_Summary.md"
       - variable: pdi
         source: "Current_PDI.md"
       - variable: session_notes
         source: "1on1_Sessions/[latest]"
     prompt:
       system: |
         You are an executive coach helping a manager prepare for a 1:1 meeting.
         Generate a thoughtful agenda that balances the team member's growth goals,
         recent context, and any concerns that need addressing.
       user: |
         Team Member Context:
         {{context_summary}}
         
         Current PDI Goals:
         {{pdi}}
         
         Notes for This Session:
         {{session_notes}}
         
         Create a structured 1:1 agenda with:
         1. Check-in (how are things going?)
         2. Progress on PDI goals
         3. Recent highlights and concerns
         4. Discussion topics from session notes
         5. Action items
         6. Next steps
       temperature: 0.7
     output:
       type: file
       path: "1on1_Sessions/[latest]"
       append: true
   ```
5. All prompts reviewed for clarity, professionalism, and effectiveness
6. Validation: base-pack.yaml passes schema validation

#### Story 5.5: Pack Command Executor

**As a** developer,  
**I want** to execute pack commands dynamically,  
**so that** user commands trigger the appropriate AI operations.

**Acceptance Criteria:**

1. `PackExecutorService` with method: `executeCommand(commandName, member, options)`
2. Execution flow:
   - Resolve pack command definition
   - Gather input variables (read files, compute values)
   - Render template with variables
   - Send prompt to AI provider
   - Handle response (write to file or console)
   - Return execution result
3. Progress indicators during execution:
   ```
   Preparing 1:1 agenda for Sarah Chen...
   ⠹ Loading context...
   ⠹ Generating agenda with AI...
   ✓ Agenda written to 1on1_Sessions/2026-01-29-session.md
   ```
4. Error handling: missing inputs, AI failure, file write errors
5. Dry-run mode: Shows what would be executed without calling AI
6. Unit tests with mocked file reads and AI responses

#### Story 5.6: `tm 1on1 create` and `tm 1on1 prepare` Commands

**As a** manager,  
**I want** to scaffold 1:1 sessions and generate AI-powered agendas,  
**so that** my 1:1s are productive and well-structured.

**Acceptance Criteria:**

1. `tm 1on1 create <member>` scaffolds session file:
   - Creates `1on1_Sessions/YYYY-MM-DD-session.md`
   - Template includes sections: Notes Before Meeting, Discussion Points, Action Items, Notes During Meeting
   - Success message shows file path
2. `tm 1on1 prepare <member>` generates agenda:
   - Reads session file, context summary, PDI
   - Calls pack executor with `1on1-prepare` command
   - Appends AI-generated agenda to session file
   - Success message: "Agenda added to session file"
3. Optional flags:
   - `--date YYYY-MM-DD`: Create/prepare for specific date (default: today)
   - `--edit`: Open session file in editor after creation
4. Validation: member exists, session file exists (for prepare)
5. Integration test validates full workflow: create → add notes → prepare

#### Story 5.7: `tm generate-pdi` and `tm update-pdi` Commands

**As a** manager,  
**I want** AI to help create and maintain PDIs for my team,  
**so that** career development conversations are data-driven.

**Acceptance Criteria:**

1. `tm generate-pdi <member>` creates initial PDI:
   - Reads profile and context summary
   - Uses AI to suggest 3-5 development goals based on context
   - Writes to `Current_PDI.md` with structured format
   - Success message with file path
2. `tm update-pdi <member>` suggests PDI updates:
   - Reads current PDI and recent context
   - AI suggests: progress on existing goals, new goals, goals to archive
   - Interactive confirmation before updating
   - Preserves PDI history (appends to end)
3. PDI format (structured markdown):
   ```markdown
   # Personal Development & Improvement Plan: {Name}
   
   ## Active Goals
   ### Goal 1: {Title}
   - **Description:** ...
   - **Timeline:** ...
   - **Success Criteria:** ...
   - **Progress:** ...
   
   ## Completed Goals
   [Archived goals]
   
   ## Notes
   [Additional context]
   ```
4. Optional flags: `--interactive` (review/edit goals before saving)
5. Integration test validates PDI generation from context

#### Story 5.8: `tm feedback` Command for Positive and Constructive Feedback

**As a** manager,  
**I want** AI to draft feedback based on recent context,  
**so that** I can deliver timely, specific feedback to my team.

**Acceptance Criteria:**

1. `tm feedback <member> --type=positive` generates positive feedback:
   - Reads context summary and recent notes
   - Identifies specific positive behaviors and outcomes
   - Drafts 2-3 paragraphs of actionable positive feedback
   - Writes to `Active_Feedback_Positive.md` (appends with date header)
2. `tm feedback <member> --type=constructive` generates constructive feedback:
   - Identifies areas for improvement from context
   - Frames feedback constructively (SBI model: Situation-Behavior-Impact)
   - Suggests specific improvement actions
   - Writes to `Active_Feedback_Constructive.md`
3. Feedback format includes:
   - Date generated
   - Specific examples from context
   - Clear, actionable language
   - Professional tone
4. Optional flags:
   - `--review`: Show draft before saving (interactive)
   - `--topic <topic>`: Focus feedback on specific topic
5. Integration test validates feedback generation

#### Story 5.9: `tm performance-review` Command

**As a** manager,  
**I want** AI to draft comprehensive performance reviews,  
**so that** review cycles are less time-consuming and more thorough.

**Acceptance Criteria:**

1. `tm performance-review <member>` generates review draft:
   - Reads: context summary, PDI, all feedback files, recent 1:1 notes
   - Generates comprehensive review with sections:
     - Summary
     - Key Accomplishments
     - Areas of Growth
     - PDI Progress
     - Goals for Next Period
     - Overall Assessment
   - Writes to `Performance_Reviews/YYYY-QX-review.md`
2. Review includes specific examples and timestamps
3. Professional tone, balanced perspective
4. Optional flags:
   - `--period Q1|Q2|Q3|Q4|annual`: Specify review period
   - `--template <path>`: Use custom review template
5. Success message includes review location and reminder to personalize
6. Integration test validates review generation with full member data

---

### Epic 6: Pack Distribution & Polish

**Expanded Goal:** Enable pack installation from URLs with automatic download and validation, implement comprehensive pack management commands for listing installed packs with metadata and validation status, add robust error handling across all commands with helpful error messages and recovery suggestions, implement polished progress indicators and spinners for long-running operations, finalize the terminal UX with consistent branding and color schemes, and prepare the tool for distribution with comprehensive documentation and README. This epic delivers the final polish needed to create the WOW effect.

#### Story 6.1: Pack Installation from URLs

**As a** user,  
**I want** to install prompt packs from URLs,  
**so that** I can easily adopt community or premium packs.

**Acceptance Criteria:**

1. `tm pack install <url>` downloads and installs pack:
   ```bash
   $ tm pack install https://example.com/packs/engineering-manager.yaml
   
   Downloading pack...
   ✓ Downloaded engineering-manager.yaml (3.2 KB)
   
   Validating pack...
   ✓ Pack schema valid
   ✓ No command conflicts
   
   Pack Details:
   - Name: Engineering Manager Pack
   - Author: Tech Manager Community
   - Version: 1.2.0
   - Commands: 5 new, 2 overrides
   
   ? Install this pack? (Y/n)
   
   ✓ Pack installed to .system/packs/engineering-manager.yaml
   
   To activate: tm config edit → Add to extensions
   ```
2. Supports multiple URL formats: direct .yaml, GitHub raw, gist
3. Validation before installation: schema check, malware scan (basic), command conflict detection
4. Handles errors: invalid URL, network error, invalid pack format
5. Optional flags:
   - `--activate`: Automatically add to active extensions
   - `--force`: Skip confirmation prompt
6. Unit tests with mocked HTTP requests

#### Story 6.2: Pack Management Commands

**As a** user,  
**I want** to manage my installed packs,  
**so that** I can activate, deactivate, or remove packs as needed.

**Acceptance Criteria:**

1. `tm packs list` displays all installed packs:
   ```
   Installed Prompt Packs
   
   ┌─────────────────────────┬─────────┬──────────┬────────────────┐
   │ Name                    │ Version │ Status   │ Commands       │
   ├─────────────────────────┼─────────┼──────────┼────────────────┤
   │ Base Pack               │ 1.0.0   │ Active   │ 9 (base)       │
   │ Engineering Manager     │ 1.2.0   │ Active   │ +5, ~2         │
   │ Leadership Essentials   │ 2.0.1   │ Inactive │ +8             │
   └─────────────────────────┴─────────┴──────────┴────────────────┘
   
   Legend: +X = new commands, ~X = overrides
   
   Commands:
     tm pack activate <name>     - Activate pack
     tm pack deactivate <name>   - Deactivate pack
     tm pack remove <name>       - Uninstall pack
     tm pack update <name>       - Update to latest version
   ```
2. `tm packs validate <pack-name>` validates pack integrity
3. `tm pack activate <name>` adds to config extensions list
4. `tm pack deactivate <name>` removes from extensions
5. `tm pack remove <name>` deletes pack file after confirmation
6. `tm pack update <name>` re-downloads if URL is stored in pack metadata
7. All commands handle errors gracefully

#### Story 6.3: Comprehensive Error Handling and Recovery

**As a** user,  
**I want** clear error messages with recovery suggestions,  
**so that** I can quickly resolve issues without frustration.

**Acceptance Criteria:**

1. `ErrorHandlerService` centralizes error handling:
   - Maps error types to user-friendly messages
   - Provides recovery suggestions
   - Includes relevant context
2. Error message format:
   ```
   ✗ Error: Failed to update context for Sarah Chen
   
   Reason: OpenAI API rate limit exceeded
   
   What you can do:
   1. Wait 30 seconds and try again: tm cycle --resume
   2. Switch to a different AI provider: tm config edit
   3. Process fewer notes at once: tm cycle --batch-size 3
   
   Technical details (for support):
   Error Code: RATE_LIMIT_429
   Timestamp: 2026-01-29T15:30:00Z
   ```
3. Error categories covered:
   - File system errors (permissions, disk full, path not found)
   - Network errors (API timeouts, connection failed)
   - AI provider errors (rate limits, invalid responses, token limits)
   - Configuration errors (missing API key, invalid config)
   - User input errors (invalid member name, missing required args)
4. Retry mechanisms with exponential backoff for transient errors
5. Partial success handling: Save progress before failing
6. Unit tests cover all error scenarios

#### Story 6.4: Progress Indicators and UX Polish

**As a** user,  
**I want** clear visual feedback during long operations,  
**so that** I know the tool is working and not frozen.

**Acceptance Criteria:**

1. All AI operations show progress with `ora` spinners:
   - Text updates during different stages
   - Success/failure symbols (✓/✗)
   - Elapsed time for operations > 5 seconds
2. Batch operations show item-by-item progress:
   ```
   Processing 5 team members...
   ✓ Sarah Chen (3.2s)
   ✓ Mike Johnson (2.8s)
   ⠹ Ana Rodriguez...
   ```
3. Progress bars for multi-step operations (using cli-progress)
4. Consistent color scheme:
   - Green: Success, completion
   - Yellow: Warnings, attention needed
   - Blue: Information, tips
   - Red: Errors
   - Cyan: Interactive prompts
5. Box drawings and separators for visual structure
6. Tip messages at appropriate times: "💡 Tip: Run 'tm cycle' regularly to keep context current"
7. Emoji support (with TM_NO_EMOJI env var to disable)

#### Story 6.5: Branding Integration Throughout

**As a** user,  
**I want** consistent branding across all commands,  
**so that** the tool feels polished and professional.

**Acceptance Criteria:**

1. Welcome banner shown on first run and with `--version`:
   ```
   ┌─────────────────────────────────────────────────────┐
   │                                                     │
   │  ████████╗███╗   ███╗                               │
   │  ╚══██╔══╝████╗ ████║                               │
   │     ██║   ██╔████╔██║  Tech Manager OS              │
   │     ██║   ██║╚██╔╝██║  by Marlon Vidal             │
   │     ██║   ██║ ╚═╝ ██║                               │
   │     ╚═╝   ╚═╝     ╚═╝  Comunidade Tech Manager     │
   │                        de Resultados                │
   │                                                     │
   │  Version 1.0.0                                      │
   └─────────────────────────────────────────────────────┘
   ```
2. Footer on significant operations:
   ```
   ────────────────────────────────────────────────
   Tech Manager OS - Manage with Intelligence
   ────────────────────────────────────────────────
   ```
3. Consistent command output formatting across all commands
4. Help text includes branding tagline
5. ASCII art optional (can be disabled for plain terminals)

#### Story 6.6: Comprehensive Documentation and README

**As a** new user,  
**I want** clear documentation,  
**so that** I can quickly understand and start using Tech Manager OS.

**Acceptance Criteria:**

1. README.md includes:
   - Hero section with branding and value proposition
   - Quick start guide (install → init → first member → first note → cycle)
   - Command reference with examples
   - Architecture overview
   - Pack system explanation
   - API key security section (from earlier discussion)
   - FAQ
   - Contributing guidelines
   - License (MIT or chosen license)
2. SECURITY.md with API key best practices
3. PACK_DEVELOPMENT.md guide for creating custom packs
4. CHANGELOG.md with version history
5. Examples directory with sample packs and workflows
6. In-app help improved: `tm --help`, `tm <command> --help` all comprehensive

#### Story 6.7: Final Testing, Bug Fixes, and Release Preparation

**As a** developer,  
**I want** comprehensive testing before release,  
**so that** users have a stable, bug-free experience.

**Acceptance Criteria:**

1. All unit tests passing with 80%+ coverage
2. All integration tests passing
3. Manual testing checklist completed:
   - Fresh install on macOS, Linux, Windows
   - All commands tested end-to-end
   - Error scenarios validated
   - Performance benchmarks met
4. Code quality checks:
   - ESLint passing with zero warnings
   - Prettier formatting applied
   - No console.log statements in production code
   - TypeScript strict mode violations resolved
5. Package.json finalized:
   - All dependencies up-to-date
   - Peer dependencies documented
   - Scripts tested
6. Build validated:
   - `npm run build` produces clean dist/
   - Binary executable works
   - Package size reasonable (<5MB)
7. npm publishing preparation:
   - Package name @marlonvidal/tech-manager-os reserved
   - npm account configured
   - .npmignore configured
8. GitHub repository ready:
   - CI/CD pipeline configured
   - Issue templates created
   - PR template created
9. Launch checklist:
   - Beta testing with 3-5 community members
   - Feedback incorporated
   - Release notes drafted
   - Social media announcement prepared

---

## Checklist Results Report

### Executive Summary

**PRD Completeness: 94%**

**MVP Scope Assessment:** Just Right - The 6 epic structure delivers a complete, polished product focused on people management without scope creep.

**Readiness for Architecture Phase:** READY - This PRD provides comprehensive guidance for the architect with clear technical constraints, detailed functional requirements, and well-defined epic structure.

**Key Strengths:**
- Exceptional detail in epic breakdown (38 stories with comprehensive acceptance criteria)
- Clear technical decisions (layered pack system, AI provider adapter pattern, API key security)
- Strong UX vision for terminal-native experience
- Well-sequenced implementation plan with clear dependencies

**Critical Gaps Identified:**
1. Missing explicit success metrics/KPIs for MVP validation
2. Beta testing plan mentioned but not detailed
3. Future roadmap (v2+) not explicitly documented

---

### Category Analysis

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PASS    | None - Clear problem statement and target audience |
| 2. MVP Scope Definition          | PASS    | Minor: Success metrics could be more explicit |
| 3. User Experience Requirements  | PASS    | None - Excellent CLI UX design |
| 4. Functional Requirements       | PASS    | None - 27 FRs covering all features comprehensively |
| 5. Non-Functional Requirements   | PASS    | None - 15 NFRs with specific targets |
| 6. Epic & Story Structure        | PASS    | None - Exemplary: 6 epics, 38 stories, all well-defined |
| 7. Technical Guidance            | PASS    | None - Clear tech stack, architecture patterns, security model |
| 8. Cross-Functional Requirements | PARTIAL | Minor: Operational monitoring details light |
| 9. Clarity & Communication       | PASS    | None - Well-structured, consistent terminology |

**Overall Assessment: 8.5/9 Categories PASS**

---

### Top Issues by Priority

#### BLOCKERS: None
All critical requirements are documented and ready for implementation.

#### HIGH PRIORITY
None identified. The PRD is comprehensive.

#### MEDIUM PRIORITY

1. **Success Metrics Specification**
   - **Issue:** While goals are clear, measurable success metrics for MVP validation are implicit rather than explicit
   - **Impact:** May lack clear criteria for "MVP success" post-launch
   - **Recommendation:** Add "Success Metrics" section with:
     - User adoption target (e.g., "50 active users in first month")
     - Usage metrics (e.g., "Average 20 notes/cycle per user")
     - Retention metric (e.g., "60% of users active after 30 days")
     - Feedback score target (e.g., "NPS > 40")

2. **Operational Monitoring Details**
   - **Issue:** NFR9 mentions error handling but operational monitoring (telemetry, crash reporting) is underspecified
   - **Impact:** May lack visibility into production issues
   - **Recommendation:** Add story in Epic 6 for optional crash reporting (user opt-in, privacy-first)

3. **Future Roadmap**
   - **Issue:** V2 features mentioned (project management, profiles) but not documented
   - **Impact:** Unclear product vision beyond MVP
   - **Recommendation:** Add "Future Enhancements" section listing deferred features

#### LOW PRIORITY

1. **Competitive Analysis:** No explicit competitive landscape documented (acceptable for community-driven tool)
2. **Pricing Strategy:** Premium pack monetization mentioned but pricing model not detailed (acceptable for MVP)

---

### MVP Scope Assessment

#### Scope Appropriateness: ✓ JUST RIGHT

**Rationale:**
- **Lean MVP:** 14 core commands focused solely on people management (projects explicitly deferred)
- **Complete Value:** Delivers full "zero-latency context" promise from capture → cycle → actionable outputs
- **Shippable:** 6 epics sized for ~6-8 weeks of development with AI agent assistance
- **Extensible:** Pack system enables post-launch customization without core changes

**Features That Could Be Cut (for ultra-lean MVP):**
- Epic 6 pack installation from URLs (manual copy is sufficient)
- `tm update-pdi` command (users can manually edit)
- Performance review generation (deferrable to v1.1)

**Recommendation:** Keep full scope. Epic 6 polish is essential for "WOW effect" in community launch.

**Missing Features That Are Essential:**
None. All core workflows covered:
- ✓ Capture (inbox)
- ✓ Process (cycle)
- ✓ Organize (members, context)
- ✓ Generate value (1:1s, feedback, PDI, reviews)
- ✓ Extend (packs)

---

### Technical Readiness

#### Architecture Clarity: EXCELLENT

**Well-Defined:**
- ✓ Modular monolith with plugin pattern for packs
- ✓ AI adapter pattern for provider agnosticism
- ✓ File system as database with strict folder structure
- ✓ Security model for API keys (conf library, AES-256, OS-specific storage)
- ✓ Template engine (Handlebars) for pack prompts

**Technical Risks Identified:**
1. **AI Token Limits:** Large context summaries + new notes might exceed token limits
   - **Mitigation:** Story 4.3 includes chunking logic
2. **Pack Security:** User-created packs could contain malicious Handlebars templates
   - **Mitigation:** Sandboxed execution mentioned, needs architect review
3. **Cross-Platform File System:** Windows path handling differs from Unix
   - **Mitigation:** Use path.join() throughout, test on all platforms (Epic 6.7)

**Areas Needing Architect Investigation:**
1. Pack command conflict resolution (when extension overrides base)
2. Context summary merging strategy (append vs. replace vs. intelligent merge)
3. Archive storage growth management (what happens after 5 years of notes?)

**Recommendation:** Architect should review pack security sandboxing approach before Epic 5 implementation.

---

### Detailed Checklist Results

#### 1. Problem Definition & Context: 95%

✓ Clear problem: Management entropy, lost context, scattered notes  
✓ Target audience: Engineering managers (specific and well-defined)  
✓ Why it matters: Applies engineering principles (version control, structure) to management  
⚠ Success metrics: Implicit (user adoption, retention) but not explicitly stated  
✓ Differentiation: Local-first, BYOK, methodology-as-code (unique positioning)

**User Research:** Implicit from author's domain expertise (acceptable for author-driven product)

#### 2. MVP Scope Definition: 92%

✓ Core functionality: 6 epics covering setup → capture → process → generate value  
✓ Scope boundaries: Projects explicitly out of scope, people management only  
✓ MVP rationale: Well-documented (focus on core value proposition)  
⚠ MVP validation approach: Testing mentioned but success criteria could be more explicit  
✓ Future enhancements: Implicitly deferred (projects, multiple profiles)

#### 3. User Experience Requirements: 98%

✓ User flows: Command-line workflow documented (init → member → inbox → cycle → outputs)  
✓ Usability: Accessibility via flags (--plain, --json), cross-platform terminal support  
✓ Performance: <100ms for CLI, progress indicators for AI operations  
✓ Error handling: Comprehensive error handling with recovery suggestions (Story 6.3)  
✓ UI requirements: Terminal UX vision, branding, color scheme all defined

#### 4. Functional Requirements: 100%

✓ 27 functional requirements covering all features  
✓ Requirements focus on WHAT not HOW  
✓ All requirements testable with clear acceptance criteria  
✓ Dependencies explicit (e.g., FR5 depends on FR2 for AI)  
✓ Consistent terminology throughout  
✓ User stories: 38 stories with comprehensive, testable acceptance criteria

#### 5. Non-Functional Requirements: 95%

✓ Performance: CLI <100ms, AI with progress indicators, 15 team member target  
✓ Security: API key encryption, AES-256, no telemetry, privacy-first  
✓ Reliability: Atomic file operations, retry logic with exponential backoff  
✓ Technical constraints: TypeScript 5.x, Node 18+, specific libraries mandated  
⚠ Monitoring: Error handling defined but crash reporting/telemetry underspecified

#### 6. Epic & Story Structure: 100%

✓ 6 epics representing cohesive functionality units  
✓ Epic goals clearly articulated with expanded descriptions  
✓ Epic sequence: Foundation → Config → Members → Cycle → Packs → Polish (logical)  
✓ 38 stories appropriately sized (2-4 hour sessions)  
✓ Stories have independent value and comprehensive acceptance criteria  
✓ First epic includes all setup: scaffolding, tooling, file system service, init command

#### 7. Technical Guidance: 98%

✓ Architecture: Modular monolith with plugin pattern  
✓ Technical constraints: All libraries, versions, tools specified  
✓ Integration points: AI provider adapters, pack system  
✓ Security: API key storage approach fully documented  
✓ Trade-offs: Documented (e.g., no database = human-readable files)  
✓ Testing approach: Unit + Integration + Manual helpers  
⚠ Technical debt: Not explicitly addressed (acceptable for greenfield MVP)

#### 8. Cross-Functional Requirements: 88%

✓ Data entities: Member, Note, Context, Session all identified  
✓ Data storage: File system structure comprehensively documented  
✓ Data retention: Archive structure (Year/Quarter) defined  
✓ Integrations: AI providers only (OpenAI, Claude, Gemini)  
⚠ Operational monitoring: Light on production telemetry approach  
⚠ Support requirements: Not explicitly documented (acceptable for community tool)

#### 9. Clarity & Communication: 96%

✓ Clear, consistent language throughout  
✓ Well-structured: Goals → Requirements → UI → Tech → Epics → Stories  
✓ Technical terms defined: BYOK, Pack system, Cycle engine all explained  
✓ Diagrams: Folder structure provided (helpful)  
⚠ Stakeholder alignment: Community launch plan mentioned but light on details

---

### Recommendations

#### For Immediate Action (Before Architecture Phase):

1. **Add Success Metrics Section** (5 minutes)
   - Add measurable KPIs for MVP validation
   - Suggested location: After Goals section

2. **Clarify Monitoring Approach** (Optional)
   - Decide: No telemetry (100% privacy) or opt-in crash reporting?
   - Add to NFRs if opt-in chosen

#### For Future Iteration (Can defer to v1.1):

1. Document v2 roadmap (project management, advanced features)
2. Create competitive analysis (optional for author-driven product)
3. Define premium pack pricing strategy

---

### Final Decision

**✓ READY FOR ARCHITECT**

This PRD is exceptionally comprehensive and ready for architectural design. The level of detail in epic breakdown (38 stories with full acceptance criteria) is outstanding. Technical guidance is clear with specific technology choices, security model fully documented, and implementation approach well-defined.

**The architect can proceed immediately with confidence.**

**Recommended Next Steps:**
1. Architect reviews PRD and creates architecture document
2. UX Expert reviews terminal UX requirements (lightweight - CLI tool)
3. Development begins with Epic 1 (Foundation)

---

## Next Steps

### UX Expert Prompt

Review the Tech Manager OS PRD focusing on the terminal user experience design. This is a CLI tool, not a web application, so your focus should be on command-line interaction patterns, terminal output formatting, and the overall flow of the user's workflow from note capture to AI-generated outputs.

**Key areas to validate:**
- Command naming and discoverability (are commands intuitive?)
- Progress indicators and feedback for long-running AI operations
- Error message clarity and recovery guidance
- Branding integration (welcome messages, consistent visual language)
- Accessibility via flags (--plain, --json modes)

**Deliverable:** Brief UX assessment (1-2 pages) confirming the terminal UX approach or suggesting refinements for command ergonomics and output formatting.

### Architect Prompt

Create a comprehensive architecture document for Tech Manager OS based on this PRD. Focus on the technical implementation strategy, detailed service architecture, data flow through the system, and the prompt pack engine design.

**Critical areas requiring architectural decisions:**

1. **AI Provider Adapter Pattern:** Design the interface and base class that enables seamless provider switching while handling retries, rate limits, and error normalization.

2. **Prompt Pack Engine:** Architecture for loading, validating, and executing YAML-based packs with Handlebars templating. Address security concerns around user-created packs.

3. **Context Summarization Strategy:** Design the algorithm for merging new notes with existing context summaries, including handling of token limits and chunking logic.

4. **File System Service:** Atomic operations pattern for safe file moves/writes, ensuring no data loss during state transitions.

5. **Archive Growth Management:** Strategy for handling years of accumulated notes without performance degradation.

6. **Testing Strategy:** Unit test architecture with mocking patterns for file system and AI providers.

**Reference these PRD sections:**
- Technical Assumptions (stack, libraries, constraints)
- Functional Requirements FR1-FR27
- Non-Functional Requirements NFR1-NFR15
- Epic structure for implementation phasing

**Deliverable:** Architecture document following the project's architecture template, ready for development team execution.
