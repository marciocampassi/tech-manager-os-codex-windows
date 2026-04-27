# Error Handling Strategy

## General Approach

- **Error Model:** TypeScript custom error classes extending `Error`
- **Exception Hierarchy:**
  - `TmrError` (base class)
    - `ConfigurationError` - Invalid configuration, missing API keys
    - `FileSystemError` - File I/O failures
    - `AIProviderError` - AI API failures
    - `ValidationError` - Invalid user input
    - `RoutingError` - File routing failures
- **Error Propagation:** Errors bubble up to command handlers, which display user-friendly messages

## Logging Standards

- **Library:** winston 3.x (structured logging)
- **Format:** JSON for file logs, colorized console for CLI output
- **Levels:**
  - `error`: Critical failures requiring user action
  - `warn`: Non-critical issues (e.g., large file warnings)
  - `info`: Normal operations (processing summary)
  - `debug`: Detailed execution info (disabled in production)
- **Log Location:** `~/.config/tmr/logs/tmr.log`
- **Required Context:**
  - **Correlation ID:** Generated per `tmr process` run for tracing
  - **Service Context:** Command name, package version
  - **User Context:** Workspace path (never log API keys or sensitive data)

## Error Handling Patterns

### External API Errors

- **Retry Policy:** Exponential backoff (1s, 2s, 4s, 8s, 16s) up to 5 retries
- **Circuit Breaker:** After 3 consecutive failures, suggest provider switch
- **Timeout Configuration:**
  - Categorization: 30s timeout
  - Agent commands: 60s timeout
- **Error Translation:**
  - 401/403 → "Invalid API key, run: tmr config add-provider"
  - 429 → "Rate limit exceeded, retrying..."
  - 500/502/503 → "Provider temporarily unavailable, retrying..."
  - 529 (Claude) → "Claude overloaded, retrying..."

### Business Logic Errors

- **Custom Exceptions:**
  - `TeamMemberNotFoundError`
  - `ProjectNotFoundError`
  - `InvalidEmailError`
  - `ConfidenceThresholdError`
- **User-Facing Errors:** Human-readable messages with actionable guidance
  ```
  ❌ Team member not found: john@company.com
  
  Did you mean one of these?
  - john.doe@company.com
  - jane@company.com
  
  Or add new member: tmr team add alpha john@company.com
  ```
- **Error Codes:** Internal codes for debugging (e.g., `TMR_E001`)

### Data Consistency

- **Transaction Strategy:** Atomic file operations - all writes succeed or all fail
- **Compensation Logic:** Rollback file moves on downstream failures
- **Idempotency:** Re-running `tmr process` on same file is safe (checks archive before processing)

## Example Error Handler

```typescript
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<Result<T>> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AIProviderError) {
      logger.error('AI Provider Error', { error, correlationId });
      return {
        success: false,
        error: `${errorMessage}: ${error.message}\nTry: tmr config set-active-provider <provider>`
      };
    }
    
    if (error instanceof FileSystemError) {
      logger.error('File System Error', { error, correlationId });
      return {
        success: false,
        error: `${errorMessage}: ${error.message}\nCheck workspace path and permissions.`
      };
    }
    
    // Unexpected errors
    logger.error('Unexpected Error', { error, correlationId, stack: error.stack });
    return {
      success: false,
      error: `Unexpected error: ${error.message}\nPlease report this issue.`
    };
  }
}
```

---
