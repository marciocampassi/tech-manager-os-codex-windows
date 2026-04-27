# Technical Assumptions

## Repository Structure

**Decision:** Monorepo with CLI + Agent System

**Rationale:**
- Single package deployment
- Unified versioning
- Clear separation: CLI (data) vs Agents (intelligence)
- Agent files are data/configuration, not separate services

## Architecture

**Hybrid Architecture: Lean CLI + Agent Ecosystem**

**Components:**

1. **CLI Layer (TypeScript/Node.js)**
   - Command parsing (Commander.js)
   - File system operations (fs-extra)
   - Configuration management (conf)
   - Inbox monitoring (chokidar)
   - Agent invocation bridge

2. **Agent System (BMAD Builder + Markdown)**
   - Agent definitions (personas, commands, dependencies) — BMAD-compliant modules
   - Skill definitions (workflow SKILL.md files)
   - Task definitions (workflows)
   - Template definitions (output formats)
   - BMAD Builder framework for extensibility and community packaging

3. **AI Adapter Layer**
   - Provider interface (OpenAI, Claude, Gemini)
   - Retry logic and rate limiting
   - Error normalization
   - Response streaming

4. **Template Engine**
   - Handlebars for variable injection
   - Frontmatter parsing (gray-matter)
   - File path resolution
   - Context aggregation

**Key Architectural Decisions:**

- **No database**: File system IS the database
- **Agent-as-configuration**: Agents are data, not code
- **Local-first**: No cloud dependencies except AI APIs
- **IDE-agnostic**: Agent system works across IDEs
- **BMAD Builder extensibility**: Community creates BMAD-compliant modules
- **Obsidian-as-vault**: The workspace folder IS the Obsidian vault; `.obsidian/` lives at root
- **Granola-as-capture**: All meeting transcripts enter via Granola Sync plugin into `inbox/`
- **Email-as-identity**: Every person-centric `{email}/` folder has a `{email}.md` identity file as the Obsidian graph node anchor

## Testing Requirements

**Testing Strategy:**

1. **Unit Tests (Jest)**
   - File system service
   - Configuration service
   - AI adapters (mocked)
   - Template engine
   - Pack validation
   - Target: 80%+ coverage

2. **Integration Tests**
   - `tmr process` end-to-end
   - Agent command execution
   - Pack loading and validation
   - File organization workflows

3. **Manual Testing Helpers**
   - Sample transcripts for cycle testing
   - Mock AI responses (no API key needed)
   - Test workspace generator

## Technology Stack

**Language & Runtime:**
- **TypeScript 5.x** with strict mode
- **Node.js 18+** (LTS)
- **ES Modules** (ESM)

**Key Libraries:**

**CLI:**
- `commander` - Command parsing
- `inquirer` - Interactive prompts
- `chalk` - Terminal colors
- `ora` - Spinners
- `cli-table3` - Tables
- `boxen` - Boxes for branding

**File System:**
- `fs-extra` - Safe file operations
- `chokidar` - File watching
- `gray-matter` - Frontmatter parsing
- `glob` - File pattern matching

**Configuration:**
- `conf` - Encrypted config storage
- `dotenv` - Environment variables

**Templating:**
- `handlebars` - Template rendering
- `yaml` - YAML parsing
- `zod` - Schema validation (for internal models; not for pack validation)

**Agent Framework:**
- **BMAD Builder** — Agent/skill/workflow definition and extensibility framework
- **Obsidian** — Local-first vault interface and primary daily workspace (user-installed; workspace IS the vault)
- **Granola Sync Plugin** (`obsidian-granola-plugin`) — Meeting note ingestion into `inbox/` (user-installed)
- **Obsidian Terminal Plugin** (`obsidian-terminal`) — Integrated terminal inside Obsidian for running `tmr` CLI commands without switching to an external IDE (user-installed; [polyipseity/obsidian-terminal](https://github.com/polyipseity/obsidian-terminal))

**AI SDKs:**
- `openai` - OpenAI API
- `@anthropic-ai/sdk` - Claude API
- `@google/generative-ai` - Gemini API

**Build & Distribution:**
- `tsup` - Fast TypeScript bundling
- Package manager: npm
- Binary: `tm` via package.json bin field
- Versioning: SemVer

## Security & Configuration

- API keys stored encrypted in OS-specific directories:
  - macOS: `~/Library/Application Support/@marlonvidal-tech-leadership-os/`
  - Linux: `~/.config/@marlonvidal-tech-leadership-os/`
  - Windows: `%APPDATA%\@marlonvidal-tech-leadership-os\`
- AES-256 encryption using `conf` library
- Environment variable overrides: `TMR_PROVIDER`, `TMR_API_KEY`
- No telemetry or data collection
- All user data stays local

## Performance Constraints

- CLI commands: <100ms response time (excluding AI)
- AI operations: Show progress after 500ms
- File operations: Atomic writes (no partial writes)
- Process command: Handle 20+ inbox files efficiently
- Binary file moves: Fast operations without processing overhead
- Retry logic: Exponential backoff for AI rate limits

---
