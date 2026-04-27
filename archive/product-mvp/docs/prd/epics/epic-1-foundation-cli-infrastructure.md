# Epic 1: Foundation & CLI Infrastructure

**Expanded Goal:** Establish a professional TypeScript/Node.js project with Commander.js CLI framework, implement secure configuration management using the `conf` library for encrypted API key storage, build the interactive onboarding workflow that collects leader profile and creates multi-team workspace structure, and deliver AI provider adapters for OpenAI, Claude, and Gemini. This epic ensures all subsequent development has a solid foundation.

## Story 1.1: Project Scaffolding and TypeScript Configuration

**As a** developer,  
**I want** a properly configured TypeScript Node.js project with all development tooling,  
**so that** I can build the CLI with type safety, linting, and automated testing.

**Acceptance Criteria:**

1. Project initialized with `package.json`:
   - Name: `@marlonvidal/tech-manager-os`
   - Version: `1.0.0`
   - Binary: `"bin": { "tm": "./dist/cli.js" }`
   - Scripts: `build`, `dev`, `test`, `lint`, `format`
2. TypeScript configured with strict mode, ES2022 target, ESNext modules
3. ESLint + Prettier configured
4. Jest configured for testing with TypeScript support
5. Husky + lint-staged for pre-commit hooks
6. Project structure: `/src`, `/tests`, `/dist`
7. README.md with project description
8. `.gitignore` properly configured

## Story 1.2: CLI Framework with Commander.js

**As a** user,  
**I want** a CLI that displays help and handles commands properly,  
**so that** I can discover available commands and understand usage.

**Acceptance Criteria:**

1. Commander.js integrated in `cli.ts`
2. `tmr --help` displays tool description, version, command list
3. `tmr --version` displays current version
4. `tmr` with no args shows help
5. Unknown commands show error with suggestion
6. Global flags work: `--verbose`, `--plain`, `--json`
7. Error handling with user-friendly messages

## Story 1.3: Configuration Service with Encrypted Storage

**As a** user,  
**I want** my API keys stored securely and encrypted,  
**so that** my credentials are protected.

**Acceptance Criteria:**

1. `ConfigService` class with methods: `initialize`, `set`, `get`, `has`, `delete`
2. Uses `conf` library with encryption in OS-specific locations
3. Config schema defined with TypeScript interface
4. API keys never logged (redaction in place)
5. Environment variable support: `TM_PROVIDER`, `TM_API_KEY`
6. Unit tests cover storage/retrieval, environment precedence

## Story 1.4: AI Provider Interface and Adapters

**As a** developer,  
**I want** a provider-agnostic AI interface,  
**so that** adding new providers doesn't require changing business logic.

**Acceptance Criteria:**

1. `AIProvider` interface defined: `name`, `testConnection()`, `generateText()`, `streamText()`
2. `AIProviderFactory` with `create()` method
3. `BaseAIProvider` with common functionality: retry logic, rate limiting
4. `OpenAIProvider` implementation using `openai` SDK
5. `AnthropicProvider` implementation using `@anthropic-ai/sdk`
6. `GeminiProvider` implementation using `@google/generative-ai`
7. Mock provider for testing
8. Unit tests with mocked SDK calls

## Story 1.5: File System Service

**As a** developer,  
**I want** a centralized service for file operations,  
**so that** operations are safe, testable, and handle errors gracefully.

**Acceptance Criteria:**

1. `FileSystemService` class with methods: `createDirectory`, `writeFile`, `readFile`, `moveFile`, `exists`
2. Uses `fs-extra` for all operations
3. Atomic write operations (temp + rename)
4. Comprehensive error handling
5. Unit tests cover happy path and error scenarios
6. Service is mockable for testing

## Story 1.6: Interactive Onboarding Workflow (`tmr init`)

**As a** new user,  
**I want** an interactive setup wizard that guides me through configuration,  
**so that** I can start using the system immediately.

**Acceptance Criteria:**

1. Displays branded welcome message
2. Interactive AI provider selection (inquirer)
3. API key input (password-style, hidden)
4. Connection validation with spinner
5. Collects manager profile:
   - Name, role, experience
   - Management style
   - Strengths and development areas
6. Collects career goals
7. Collects leadership context (manager's name, expectations)
8. Creates complete directory structure
9. Generates initial files: `my-career/profile.md`, `my-career/pdp.md`, `my-leadership/profile.md`
10. Creates IDE integration files (`.cursor/`, `.claude/`, `.gemini/`)
11. Displays next steps
12. Integration test validates full workflow

---
