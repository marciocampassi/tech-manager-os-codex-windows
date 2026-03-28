# External APIs

## External API: OpenAI API

**Purpose:** Provides GPT-5 language models for transcript categorization, task extraction, and agent responses when OpenAI is the active provider.

**Documentation:** https://platform.openai.com/docs/api-reference

**Base URL(s):** `https://api.openai.com/v1`

**Authentication:** Bearer token (API key) in `Authorization` header

**Rate Limits:** 
- Free tier: 3 RPM, 40,000 TPM
- Tier 1 ($5+ spent): 500 RPM, 200,000 TPM
- Tier 5 ($1,000+ spent): 10,000 RPM, 5,000,000 TPM

**Key Endpoints Used:**
- `POST /v1/chat/completions` - Main endpoint for categorization and agent responses
  - Supports streaming for real-time responses
  - Function calling for structured outputs
  - Structured outputs via JSON schema (`response_format`)

**Available Models (2026):**
- **gpt-5-mini** - Fast and cost-effective (400K context, 128K output) - **Recommended for MVP**
- **gpt-5-nano** - Ultra-fast responses (400K context, 128K output)
- **gpt-5-pro** - Advanced reasoning with "reasoning_effort" parameter (best for complex tasks)
- **gpt-5** - General purpose flagship model

**Integration Notes:**
- **Recommended:** Use `gpt-5-mini` for balance of speed and quality
- Implement exponential backoff for rate limit errors (429)
- Handle token limits gracefully - truncate long transcripts if needed
- Enable streaming for agent commands to improve perceived latency
- Use structured outputs via JSON schema for consistent categorization results
- Cost: ~$0.05 per 1M input tokens (gpt-5-nano), ~$0.40 per 1M output tokens

---

## External API: Anthropic Claude API

**Purpose:** Provides Claude 4.x models for transcript categorization, task extraction, and agent responses when Claude is the active provider.

**Documentation:** https://docs.anthropic.com/claude/reference/getting-started-with-the-api

**Base URL(s):** `https://api.anthropic.com/v1`

**Authentication:** `x-api-key` header with API key

**Rate Limits:**
- Tier 1 (default): 50 RPM, 40,000 TPM
- Tier 4 ($1,000+ spent): 4,000 RPM, 400,000 TPM

**Key Endpoints Used:**
- `POST /v1/messages` - Main endpoint for categorization and agent responses
  - Supports prompt caching (cache frequently used context like agent personas)
  - Streaming support via Server-Sent Events

**Available Models (2026):**
- **claude-sonnet-4-5-20250929** - Best for real-world agents and coding - **Recommended for MVP**
- **claude-haiku-4-5-20251001** - Fastest hybrid model (near-instant + extended thinking)
- **claude-opus-4-1-20250805** - Most capable model for complex reasoning
- **claude-sonnet-4-20250514** - High-performance with extended thinking
- **Legacy:** claude-3-opus-20240229, claude-3-haiku-20240307 (deprecated)

**Context Windows:**
- Standard: 200K tokens
- Beta: 1M token context window available

**Integration Notes:**
- **Recommended:** `claude-sonnet-4-5-20250929` (best cost/performance balance for agents and coding)
- Use prompt caching for agent system prompts - reduces costs by 90% on cached tokens
- Claude has superior instruction following for structured outputs
- Handle 529 errors (overloaded) with retry logic
- Maximum 5 retries per request with exponential backoff
- Extended thinking capability enables complex reasoning tasks
- Max output: 64K tokens (Sonnet 4.6), 128K tokens (Opus 4.6)

---

## External API: Google Gemini API

**Purpose:** Provides Gemini 2.5 models for transcript categorization, task extraction, and agent responses when Gemini is the active provider.

**Documentation:** https://ai.google.dev/gemini-api/docs

**Base URL(s):** 
- `https://generativelanguage.googleapis.com/v1beta`
- OpenAI-compatible endpoint: `https://generativelanguage.googleapis.com/v1beta/openai`

**Authentication:** API key as query parameter `?key={API_KEY}` OR `Authorization: Bearer {API_KEY}` header (OpenAI-compatible endpoint)

**Rate Limits:**
- Free tier: 15 RPM, 32,000 TPM, 1,500 RPD
- Paid tier: 360 RPM, 4,000,000 TPM

**Key Endpoints Used:**
- `POST /v1beta/models/{model}:generateContent` - Main endpoint for text generation
- `POST /v1beta/models/{model}:streamGenerateContent` - Streaming variant
- `GET /v1beta/openai/models` - List available models (OpenAI-compatible)

**Available Models (2026):**
- **gemini-2.5-flash** - Production-ready, general purpose (1M context, 65K output) - **Recommended for MVP**
- **gemini-2.5-flash-lite** - Lightweight, efficient (1M context, 65K output)
- **gemini-2.5-pro** - State-of-the-art reasoning for complex problems (1M context, 65K output)
- **gemini-3-flash-preview** - Next-gen preview model (experimental)
- **Deprecated:** gemini-2.0-flash (shutdown March 31, 2026)

**Integration Notes:**
- **Recommended:** `gemini-2.5-flash` (best balance, multimodal support, 1M context window)
- Multimodal support available (future: process image/video attachments from meetings)
- Free tier is generous for MVP testing (15 RPM sufficient for initial users)
- JSON mode for structured outputs (`response_mime_type: "application/json"`)
- Handles longer context windows exceptionally well (1M tokens)
- Supports comprehensive capabilities: function calling, code execution, caching, structured outputs, thinking mode
- Latest update: June 2025, Knowledge cutoff: January 2025

---

## External API: Granola (Indirect Integration)

**Purpose:** Meeting transcription tool that syncs transcripts to Obsidian vault via plugin. Tech Leadership OS consumes Granola output but doesn't directly call Granola APIs.

**Documentation:** https://www.granola.so/obsidian

**Integration Method:** File-based (Granola Sync Obsidian plugin writes to `inbox/`)

**Expected File Format:**
```markdown
---
granola_id: abc123
title: "1:1 with John Doe"
date: 2026-02-19
attendees:
  - john.doe@company.com
  - marlon@company.com
type: meeting
---

# 1:1 with John Doe

# Transcript

[Transcript content here...]
```

**Integration Notes:**
- Granola plugin writes files directly to `inbox/` folder
- Frontmatter fields are primary routing signals for `process-meeting-note` skill
- `attendees` field automatically extracted and converted to `[[@email]]` links
- No API key required - purely file-based integration
- User must manually enable Granola Sync plugin in Obsidian

---

## External API: Google Drive & Docs API

**Purpose:** Creates Google Docs for team member action items trackers, shares documents with team members, and manages Drive folder structure. Activated only when `google_drive_enabled: true` in config.

**Documentation:**
- Drive API: https://developers.google.com/drive/api/v3/reference
- Docs API: https://developers.google.com/docs/api/reference/rest

**Base URL(s):**
- `https://www.googleapis.com/drive/v3`
- `https://docs.googleapis.com/v1`

**Authentication:** OAuth2 (user-authorized; Desktop app flow with local redirect on `http://localhost:3000/oauth2callback`)

**OAuth Scopes:**
- `https://www.googleapis.com/auth/drive.file` — create and manage files the app creates
- `https://www.googleapis.com/auth/drive` — read Drive folder structure

**Key Endpoints Used:**
- `POST /drive/v3/files` — Create Google Doc in specified folder
- `POST /drive/v3/files/{fileId}/permissions` — Share document with team member email
- `GET /drive/v3/files` — Find existing member subfolders
- `POST /docs/v1/documents/{documentId}:batchUpdate` — Insert content into document

**Rate Limits:**
- Drive API: 1,000 requests/100 seconds/user
- Docs API: 300 requests/60 seconds/user

**Integration Notes:**
- All calls wrapped in `GoogleDriveService` — integration is fully config-gated
- Failures are caught and logged; never block local `.md` file creation
- MVP: plain text content insertion; rich-text table formatting deferred to future story
- OAuth token stored encrypted in config via `ConfigService`
- Client credentials (Client ID + Secret) collected during `tmr init` Google setup prompt

---

## AI Provider Comparison Matrix (2026)

| Feature | OpenAI | Claude | Gemini |
|---------|--------|--------|--------|
| **Recommended Model** | gpt-5-mini | claude-sonnet-4-5-20250929 | gemini-2.5-flash |
| **Context Window** | 400K tokens | 200K (1M beta) | 1M tokens |
| **Max Output** | 128K tokens | 64K tokens (Sonnet) | 65K tokens |
| **Cost (per 1M input)** | $0.05 (gpt-5-mini) | ~$3 (Sonnet 4.5) | Free tier / $0.075 (Flash) |
| **Streaming** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Function Calling** | ✅ Yes | ✅ Yes (Tool Use) | ✅ Yes |
| **Structured Outputs** | ✅ JSON schema | ✅ Via prompting | ✅ JSON mode |
| **Caching** | ❌ No | ✅ Prompt caching (90% discount) | ✅ Yes |
| **Extended Thinking** | ✅ Yes (gpt-5-pro) | ✅ Yes (all 4.x models) | ✅ Yes (thinking mode) |
| **Multimodal** | ✅ Audio, Image | ✅ Audio, Image, Video | ✅ Audio, Image, Video, PDF |
| **Rate Limits (Paid)** | 500 RPM (Tier 1) | 50 RPM (Tier 1) | 360 RPM (Paid) |
| **Best For** | Structured outputs, speed | Agents, coding, instruction following | Cost optimization, long context, multimodal |

**Recommendation Priority for Tech Leadership OS:**
1. **Claude Sonnet 4.5** - Best for agent workflows and coding tasks, excellent instruction following
2. **Gemini 2.5 Flash** - Most cost-effective with 1M context, excellent for long transcripts
3. **GPT-5 Mini** - Good balance if user prefers OpenAI ecosystem

---

## `tmr process` Command - Complete Execution Flow

This diagram shows the detailed method call chain when a user runs `tmr process`:

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER ACTION: tmr process                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CLI ENTRY POINT                                                  │
│    CLICommandDispatcher.parse()                                     │
│    ├─> Commander.js parses arguments                               │
│    └─> InboxProcessorCommand.execute()                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. INBOX SCANNING                                                   │
│    InboxProcessorEngine.processInbox()                              │
│    └─> FileSystemRepository.listFiles('inbox/')                    │
│        Returns: ['inbox/meeting-with-john.md',                     │
│                  'inbox/project-update.md']                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. FOR EACH FILE - CATEGORIZATION PHASE                            │
│                                                                      │
│    FileSystemRepository.readFile(file)                              │
│    FileSystemRepository.parseFrontmatter(file)                      │
│    ├─> Returns: { granola_id, title, date, attendees, type }      │
│    │                                                                 │
│    └─> CategorizationService.categorize(file, frontmatter)         │
│        │                                                             │
│        ├─> AgentOrchestrator.executeSkill('process-meeting-note')  │
│        │   │                                                         │
│        │   ├─> Load lightweight identity context:                   │
│        │   │   FileSystemRepository.listFiles('my-teams/**/*/profile.md')│
│        │   │   Extract: emails + names only (not full context)      │
│        │   │                                                         │
│        │   ├─> BMAD Skill builds specialized prompt                 │
│        │   │                                                         │
│        │   └─> AIProviderAbstraction.categorize({                   │
│        │         transcript: fileContent,                           │
│        │         identityContext: { emails, names },                │
│        │         model: activeProvider                              │
│        │       })                                                    │
│        │       │                                                     │
│        │       ├─> ConfigService.getActiveProvider()                │
│        │       │   Returns: { name: 'claude', apiKey: '...', model: 'claude-sonnet-4-5-20250929' }│
│        │       │                                                     │
│        │       └─> ClaudeProvider.chat() OR OpenAIProvider.chat() OR GeminiProvider.chat()│
│        │           │                                                 │
│        │           └─> **EXTERNAL API CALL**                        │
│        │               POST https://api.anthropic.com/v1/messages   │
│        │               (or OpenAI/Gemini equivalent)                 │
│        │               │                                             │
│        │               Returns: {                                   │
│        │                 category: '1:1',                            │
│        │                 person: 'john.doe@company.com',            │
│        │                 project: null,                              │
│        │                 topics: ['career', 'performance'],          │
│        │                 confidence: 0.92,                           │
│        │                 rationale: 'Meeting titled "1:1 with John"'│
│        │               }                                             │
│        │                                                             │
│        └─> BMAD Skill formats AI response into:                    │
│            CategorizationResult {                                   │
│              primaryDestination: 'my-teams/alpha/john.doe@company.com/1on1s/',│
│              secondaryDestinations: [],                             │
│              contextUpdates: [{                                     │
│                path: 'my-teams/alpha/john.doe@company.com/context.md',│
│                summary: '...',                                      │
│                topics: ['career', 'performance'],                   │
│                sentiment: 'positive'                                 │
│              }],                                                     │
│              taskExtracts: [{                                       │
│                title: 'Review performance goals',                   │
│                due: '2026-02-25',                                   │
│                priority: 'high'                                     │
│              }],                                                     │
│              confidence: 0.92,                                      │
│              rationale: '...'                                       │
│            }                                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. ROUTING DECISION PHASE                                           │
│                                                                      │
│    RoutingEngine.route(file, categorizationResult)                  │
│    │                                                                 │
│    ├─> Check confidence threshold                                   │
│    │   if (confidence < 0.75):                                     │
│    │     RoutingEngine.promptUserConfirmation(decision)             │
│    │     ├─> Display: "Confidence: 0.65 - Is this correct?"       │
│    │     └─> Wait for user input (approve/modify)                  │
│    │                                                                 │
│    └─> Returns: RoutingDecision (approved or user-modified)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. FILE ROUTING EXECUTION                                           │
│                                                                      │
│    FileSystemRepository.moveFile(                                   │
│      'inbox/meeting-with-john.md',                                 │
│      'my-teams/alpha/john.doe@company.com/1on1s/2026-02-19.md'    │
│    )                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. CONTEXT UPDATE PHASE (Append-Only)                              │
│                                                                      │
│    for (contextUpdate in categorizationResult.contextUpdates):     │
│      │                                                               │
│      ├─> ContextUpdater.appendContext(                             │
│      │     path: 'my-teams/alpha/john.doe@company.com/context.md', │
│      │     entry: {                                                 │
│      │       date: '2026-02-20',                                   │
│      │       source: '[[...1on1s/2026-02-19.md]]',                │
│      │       summary: contextUpdate.summary,                        │
│      │       topics: contextUpdate.topics,                          │
│      │       sentiment: contextUpdate.sentiment                     │
│      │     }                                                         │
│      │   )                                                           │
│      │   │                                                           │
│      │   ├─> ContextUpdater.formatContextEntry(entry)              │
│      │   │   Returns: markdown-formatted entry                      │
│      │   │                                                           │
│      │   └─> FileSystemRepository.appendFile(                      │
│      │         'my-teams/.../context.md',                           │
│      │         formattedEntry                                       │
│      │       )                                                       │
│      │                                                               │
│      └─> ContextUpdater.checkFileSize(path)                        │
│          if (fileSize > 500KB):                                    │
│            Display warning: "⚠️ Context file >500KB, consider archiving"│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. TASK EXTRACTION PHASE                                            │
│                                                                      │
│    for (task in categorizationResult.taskExtracts):                │
│      │                                                               │
│      ├─> TaskExtractor.categorizeByTimeHorizon(task)               │
│      │   if (task.due == today OR overdue): return 'today'         │
│      │   if (task.due <= 7 days): return 'this-week'              │
│      │   if (task.due <= 30 days): return 'this-month'            │
│      │   else: return 'this-quarter'                               │
│      │   Returns: 'this-week'                                      │
│      │                                                               │
│      └─> TaskExtractor.appendToTaskFile(task, 'this-week')         │
│          │                                                           │
│          └─> FileSystemRepository.appendFile(                      │
│                'my-tasks/this-week.md',                             │
│                formattedTaskEntry                                   │
│              )                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. ARCHIVE PHASE                                                    │
│                                                                      │
│    FileSystemRepository.moveFile(                                   │
│      'inbox/meeting-with-john.md',                                 │
│      'archive/2026/02/inbox/meeting-with-john.md'                  │
│    )                                                                 │
│    │                                                                 │
│    └─> FileSystemRepository.appendFrontmatter(                     │
│          'archive/2026/02/inbox/meeting-with-john.md',             │
│          {                                                           │
│            processed: true,                                         │
│            processed_date: '2026-02-20',                           │
│            routed_to: ['my-teams/.../1on1s/2026-02-19.md']        │
│          }                                                           │
│        )                                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. PROCESS LOG (Optional)                                           │
│                                                                      │
│    if (config.process_log_enabled):                                │
│      FileSystemRepository.appendFile(                               │
│        'my-tasks/process-log.md',                                   │
│        processLogEntry                                              │
│      )                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 10. DISPLAY PROCESSING SUMMARY                                      │
│                                                                      │
│     ✅ Processed 2 files                                           │
│     📁 Routed:                                                      │
│       - meeting-with-john.md → my-teams/.../1on1s/ (confidence: 0.92)│
│       - project-update.md → my-projects/api-redesign/ (confidence: 0.88)│
│     📝 Extracted 3 tasks                                            │
│     ⚠️  1 warning: context.md file size approaching 500KB          │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Observations:**
- **Single AI call per transcript** - BMAD skill makes one API call that returns complete manifest
- **O(1) token cost** - Only new transcript + lightweight identity context sent to AI
- **Append-only updates** - Context files never read during processing, only appended
- **Confidence-gated** - Human confirmation required for low-confidence routing
- **Atomic operations** - All file operations complete or fail together

---
