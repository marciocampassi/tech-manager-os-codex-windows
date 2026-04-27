# Coding Standards

**CRITICAL:** These standards are MANDATORY for AI agents and human developers. They directly control code generation behavior.

## Core Standards

- **Languages & Runtimes:** TypeScript 5.3.3, Node.js 20.17.0 LTS
- **Style & Linting:** ESLint + @typescript-eslint, Prettier for formatting
- **Test Organization:** Test files in `tests/` directory, mirror source structure
  - Unit tests: `*.test.ts`
  - Integration tests: `*.integration.test.ts`
  - Test coverage minimum: 80%

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `InboxProcessor`, `AIProvider` |
| Interfaces | PascalCase with `I` prefix | `IAIProvider`, `IConfigService` |
| Types | PascalCase | `CategorizationResult`, `RoutingDecision` |
| Functions/Methods | camelCase | `processInbox()`, `categorizeFile()` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_CONFIDENCE_THRESHOLD`, `MAX_RETRIES` |
| Files | kebab-case | `inbox-processor.ts`, `ai-provider.interface.ts` |
| Private members | camelCase with `_` prefix | `_apiKey`, `_retryCount` |

## Critical Rules

- **Never use `console.log` in production code** - Use `logger.info()`, `logger.debug()`, etc.
- **All API responses must use `Result<T>` wrapper type** - No throwing errors from async functions
  ```typescript
  type Result<T> = 
    | { success: true; data: T }
    | { success: false; error: string };
  ```
- **File system operations must use `FileSystemRepository`** - Never direct `fs` calls
- **AI calls must go through `AIProviderAbstraction`** - Never direct SDK calls
- **All external inputs must be validated** - Use Zod schemas at boundaries
- **Email addresses must use lowercase** - Normalize before storage
- **Dates must use ISO 8601 format** - `2026-02-20T14:30:00Z`
- **Never log API keys, tokens, or PII** - Sanitize logs
- **Always handle Promise rejections** - No unhandled rejections
- **Use dependency injection** - Constructor injection for testability

## TypeScript Specifics

- **Strict mode enabled** - `"strict": true` in tsconfig.json
- **Explicit return types** - Always declare function return types
- **No `any` types** - Use `unknown` and type guards instead
- **Prefer `interface` over `type`** - For object shapes
- **Use enums for constants** - Type-safe string constants
  ```typescript
  enum ProcessingStatus {
    Pending = 'pending',
    InProgress = 'in-progress',
    Completed = 'completed',
    Failed = 'failed'
  }
  ```
- **Async/await over Promises** - More readable error handling
- **Nullish coalescing (`??`)** - Prefer over `||` for default values

---
