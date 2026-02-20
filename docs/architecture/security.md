# Security

## Input Validation

- **Validation Library:** Zod (TypeScript-first schema validation)
- **Validation Location:** At command boundaries (CLI argument parsing, file parsing)
- **Required Rules:**
  - All external inputs MUST be validated before processing
  - Validation at CLI command entry point before passing to core
  - Whitelist approach preferred over blacklist
  - Email addresses validated via regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - File paths sanitized to prevent directory traversal

**Example:**
```typescript
import { z } from 'zod';

const TeamMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50),
  team: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(['active', 'inactive'])
});

// Usage
function validateTeamMember(input: unknown): Result<TeamMember> {
  const result = TeamMemberSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}
```

## Authentication & Authorization

- **Auth Method:** N/A (local CLI, no multi-user authentication)
- **Session Management:** N/A (stateless CLI commands)
- **Required Patterns:**
  - File system permissions checked before operations
  - Workspace path validated during `tmr init`
  - No authentication system needed (single-user local application)

## Secrets Management

- **Development:** API keys entered interactively, never committed to git
- **Production:** API keys stored encrypted in OS-specific config directory
- **Code Requirements:**
  - NEVER hardcode secrets or API keys
  - Access via `ConfigService` only
  - No secrets in logs or error messages
  - API keys encrypted using AES-256-CBC with machine-specific salt
  - Keytar integration (optional) for native OS keychain storage

**Encryption Implementation:**
```typescript
import CryptoJS from 'crypto-js';
import os from 'os';

function encryptApiKey(apiKey: string): string {
  const salt = os.hostname(); // Machine-specific salt
  const encrypted = CryptoJS.AES.encrypt(apiKey, salt).toString();
  return encrypted;
}

function decryptApiKey(encrypted: string): string {
  const salt = os.hostname();
  const decrypted = CryptoJS.AES.decrypt(encrypted, salt);
  return decrypted.toString(CryptoJS.enc.Utf8);
}
```

## API Security

- **Rate Limiting:** Handled by external AI providers (OpenAI, Claude, Gemini)
- **CORS Policy:** N/A (no web server)
- **Security Headers:** N/A (CLI application)
- **HTTPS Enforcement:** All AI provider API calls use HTTPS

## Data Protection

- **Encryption at Rest:** 
  - API keys encrypted (AES-256-CBC)
  - Workspace files NOT encrypted (user manages via OS-level encryption)
  - User responsible for disk encryption if needed
- **Encryption in Transit:** HTTPS for all AI provider API calls
- **PII Handling:**
  - Team member data (names, emails) stored in plaintext markdown
  - User assumes responsibility for workspace data security
  - No data leaves local machine except AI API calls (transcripts only)
  - Support `.gitignore` suggestions to prevent accidental commit of sensitive files
- **Logging Restrictions:**
  - NEVER log API keys
  - NEVER log full transcripts (only metadata)
  - NEVER log user email addresses in external services
  - Sanitize all logs before writing

## Dependency Security

- **Scanning Tool:** `npm audit` (built into npm/pnpm)
- **Update Policy:** 
  - Critical vulnerabilities: Immediate patch release
  - High vulnerabilities: Patch within 7 days
  - Medium/Low: Address in next minor release
- **Approval Process:** 
  - New dependencies require security review
  - Check npm package reputation and maintenance status
  - Prefer packages with high usage and active maintenance
  - Document rationale for new dependencies

## Security Testing

- **SAST Tool:** ESLint security plugins (`eslint-plugin-security`)
- **DAST Tool:** N/A (no web application)
- **Penetration Testing:** N/A for MVP (local-first application)
- **Dependency Scanning:** Automated via GitHub Dependabot

## Security Checklist

- [ ] API keys never committed to git (`.gitignore` includes config files)
- [ ] All user inputs validated with Zod schemas
- [ ] File paths sanitized to prevent directory traversal
- [ ] HTTPS enforced for all external API calls
- [ ] Secrets encrypted at rest
- [ ] No sensitive data in logs
- [ ] Dependencies scanned for vulnerabilities in CI
- [ ] Error messages don't leak sensitive information
- [ ] File permissions checked before write operations

---
