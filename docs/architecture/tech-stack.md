# Tech Stack

## Cloud Infrastructure

**Provider:** **None (Local-First)**

**Key Services:** N/A - This is a local CLI application with no cloud infrastructure

**Deployment Regions:** N/A - Runs on user's local machine

**Note:** Future versions may add optional cloud sync features (similar to Obsidian Sync), but MVP is 100% local.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Runtime** | Node.js | 20.17.0 LTS | JavaScript runtime | LTS stability, BMAD Builder compatibility, widest ecosystem support |
| **Language** | TypeScript | 5.3.3 | Primary development language | Type safety, excellent tooling, IDE integration, team productivity |
| **Package Manager** | pnpm | 9.x | Dependency management and monorepo workspaces | Fastest installs, disk space efficiency, excellent monorepo support |
| **CLI Framework** | Commander.js | 12.x | Command-line interface structure | Industry standard (npm, create-react-app use it), extensible, well-documented |
| **Agent Framework** | BMAD Builder | Latest | Agent and skill system extensibility | PRD requirement, community-compatible agent definitions, standardized workflows |
| **AI SDK (OpenAI)** | openai | 4.x | OpenAI API client | Official SDK, streaming support, function calling |
| **AI SDK (Anthropic)** | @anthropic-ai/sdk | 0.28.x | Claude API client | Official SDK, prompt caching, streaming |
| **AI SDK (Google)** | @google/generative-ai | 0.21.x | Gemini API client | Official SDK, multimodal support |
| **Testing Framework** | Vitest | 1.x | Unit and integration testing | Fast, native TypeScript, modern DX, growing adoption |
| **Markdown Parser** | unified + remark | 11.x + 15.x | Markdown processing and AST manipulation | Obsidian compatibility, plugin ecosystem, wikilink support via remark-wiki-link |
| **Frontmatter Parser** | gray-matter | 4.x | YAML frontmatter extraction | Standard library, Obsidian-compatible, reliable |
| **File Watcher** | chokidar | 3.x | Inbox directory monitoring for `tmr watch` | Cross-platform, reliable, handles edge cases better than native fs.watch |
| **Configuration** | conf | 12.x | Cross-platform user config storage | Atomic writes, schema validation, XDG-compliant paths |
| **Encryption** | crypto-js | 4.x | API key encryption (primary) | Secure credential storage, no native dependencies, cross-platform |
| **Keychain Access** | keytar | 7.x | Native OS keychain integration (optional fallback) | Enhanced security via OS keychain, user opt-in for native storage |
| **CLI Styling** | chalk | 5.x | Terminal colors and styling | De facto standard, excellent compatibility, readable output |
| **CLI Progress** | ora | 8.x | Spinners and progress indicators | Beautiful UX, minimal overhead, widely used |
| **CLI Prompts** | inquirer | 9.x | Interactive prompts for `tmr init` | Rich prompt types, validation, well-tested |
| **Linting** | ESLint + @typescript-eslint | 8.x + 6.x | Code quality and consistency | TypeScript-aware linting, catches common errors |
| **Formatting** | Prettier | 3.x | Code formatting | Consistent style, zero-config for TypeScript, team standard |
| **Git Hooks** | husky | 9.x | Pre-commit code quality checks | Enforce linting/testing before commits, team discipline |
| **Build Tool** | tsup | 8.x | TypeScript bundling and compilation | Fast builds, ESM + CJS support, minification, simpler than Rollup |

**CRITICAL:** This table is the **single source of truth** for all technology choices. Any other document or code must reference these exact versions.

**Version Pinning Strategy:**
- Major versions specified in this document (e.g., `20.x`, `5.x`)
- `package.json` uses exact versions (e.g., `"typescript": "5.3.3"`) for reproducible builds
- Dependencies reviewed and updated quarterly after testing

---
