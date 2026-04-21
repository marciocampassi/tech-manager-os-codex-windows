# Security

## API Key Storage

`tech-manager-os` stores your AI API key locally using [`conf`](https://github.com/sindresorhus/conf), a cross-platform configuration library that follows XDG base directory conventions.

**Storage locations by platform:**

| Platform | Path |
|----------|------|
| macOS | `~/Library/Preferences/tech-manager-os-nodejs/` |
| Linux | `~/.config/tech-manager-os-nodejs/` |
| Windows | `%APPDATA%\tech-manager-os-nodejs\` |

Your API key is **encrypted before storage** using `crypto-js` (AES encryption). The encryption key is derived from your machine's unique identifiers — the encrypted value is useless on a different machine.

**Optional: OS Keychain**  
You can opt in to storing your API key in your operating system's native keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) via `keytar`. This provides an additional layer of security. Enable it with `tmr config --keychain`.

---

## What Is Encrypted

- ✅ Your AI provider API key — encrypted at rest
- ✅ Optional keychain storage available

## What Is NOT Encrypted

- Your vault's Markdown files (plain text, Obsidian-compatible)
- Your `CLAUDE.md` identity file (plain text by design — Claude Code reads it directly)
- Configuration metadata other than the API key (provider name, vault path)

---

## What Is Transmitted

`tech-manager-os` is a **local-first** tool. The only network request it makes is the AI API call during `tmr process`:

| Operation | Network? | What is sent |
|-----------|----------|-------------|
| `tmr init` | ❌ No | Nothing — pure local scaffolding |
| `tmr config` | ❌ No | Nothing — key stored locally |
| `tmr process` | ✅ Yes | Meeting transcript content sent to your AI provider |
| `tmr watch` | ✅ Yes | Same as `tmr process` for each file |
| `tmr install` | ✅ Yes | Fetches SKILL.md from GitHub — no personal data |
| `tmr update` | ✅ Yes | Same as `tmr install` — no personal data |
| All other commands | ❌ No | Nothing |

**When you run `tmr process`**, the content of your meeting transcripts is sent to your configured AI provider (OpenAI, Anthropic, or Google). Review your AI provider's data usage and privacy policy:

- [OpenAI Privacy Policy](https://openai.com/privacy/)
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [Google AI Privacy Policy](https://policies.google.com/privacy)

---

## Best Practices

### Use a Dedicated API Key
Create a separate API key for `tmr` rather than reusing a key shared across many tools. This limits blast radius if the key is compromised.

### Set Spending Limits
Configure a monthly spending limit in your AI provider dashboard:
- [OpenAI usage limits](https://platform.openai.com/account/limits)
- [Anthropic usage limits](https://console.anthropic.com/)
- [Google AI quotas](https://aistudio.google.com/app/apikey)

### Rotate Keys Periodically
Rotate your API key every 90 days as a precaution. Run `tmr config` again to update the stored key — the old key can then be revoked in your provider dashboard.

### Do Not Commit Your Config Directory
The `conf` config directory is outside your vault and not tracked by git. However, if you store your vault in a git repository, ensure `.gitignore` excludes sensitive files:

```gitignore
# Already excluded by default vault .gitignore
.env
*.key
```

### Protect Your Vault
Your vault contains meeting notes and personal context. Treat it like any sensitive document:
- Store it in a location that requires authentication (home directory, encrypted drive)
- Do not sync to a public cloud service
- Use disk encryption (FileVault on macOS, BitLocker on Windows)

---

## Reporting Vulnerabilities

**Non-critical issues** (documentation bugs, low-severity concerns): Open a [GitHub issue](https://github.com/marlonvidal/tech-manager-os/issues).

**Critical security vulnerabilities** (key exposure, injection, data leaks): Please **do not** open a public issue. Email `security@tech-manager-os.dev` with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 72 hours and coordinate a responsible disclosure timeline.

---

## Acknowledgments

`tech-manager-os` uses the following security-relevant libraries:

| Library | Purpose | Audit |
|---------|---------|-------|
| `crypto-js` | AES encryption for API key storage | [npm](https://www.npmjs.com/package/crypto-js) |
| `keytar` | Optional OS keychain integration | [npm](https://www.npmjs.com/package/keytar) |
| `conf` | Configuration storage (XDG-compliant, atomic writes) | [npm](https://www.npmjs.com/package/conf) |
