# Core Workflows

## Workflow 1: User Initialization (`tmr init`)

This sequence diagram illustrates the interactive onboarding workflow when a new user initializes Tech Leadership OS.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Dispatcher
    participant Init as Init Command
    participant Config as Config Service
    participant FS as File System Repository
    participant AI as AI Provider

    User->>CLI: tmr init
    CLI->>Init: execute()
    
    Init->>User: Welcome! Let's set up your workspace.
    Init->>User: Where is your Obsidian vault? (prompt)
    User->>Init: /Users/marlon/tmr-workspace
    
    Init->>FS: validateDirectory(path)
    FS-->>Init: Valid
    
    Init->>User: Select AI provider: (1) OpenAI (2) Claude (3) Gemini
    User->>Init: 2 (Claude)
    
    Init->>User: Enter Claude API key:
    User->>Init: sk-ant-***
    
    Init->>AI: validateApiKey(claude, key)
    AI-->>Init: Valid
    
    Init->>Config: saveConfig({ workspace, provider, apiKey })
    Config->>Config: encryptApiKey(apiKey)
    Config->>FS: writeFile(~/.config/tmr/config.json)
    
    Init->>User: What's your name?
    User->>Init: Marlon Vidal
    
    Init->>User: What's your email?
    User->>Init: marlon@company.com
    
    Init->>User: What's your role?
    User->>Init: Engineering Manager
    
    Init->>FS: createDirectoryStructure(workspace)
    FS->>FS: mkdir inbox/, my-teams/, my-projects/, etc.
    
    Init->>FS: createProfile(my-career/profile.md, userInfo)
    FS-->>Init: Created
    
    Init->>FS: createTemplates(utils/, .tmr-core/)
    FS-->>Init: Created
    
    Init->>User: ✅ Setup complete! Next steps:<br/>1. Enable Granola Sync plugin in Obsidian<br/>2. Add team members: tmr team add<br/>3. Drop transcripts in inbox/ and run: tmr process
```

---

## Workflow 2: Inbox Processing with High Confidence

This sequence shows successful automatic processing when AI categorization confidence exceeds threshold.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Dispatcher
    participant Inbox as Inbox Processor
    participant Cat as Categorization Service
    participant Agent as Agent Orchestrator
    participant AI as AI Provider (Claude)
    participant Route as Routing Engine
    participant CTX as Context Updater
    participant Task as Task Extractor
    participant FS as File System Repository

    User->>CLI: tmr process
    CLI->>Inbox: processInbox()
    
    Inbox->>FS: listFiles('inbox/')
    FS-->>Inbox: ['inbox/1on1-john.md']
    
    Inbox->>FS: readFile('inbox/1on1-john.md')
    FS-->>Inbox: content + frontmatter
    
    Inbox->>Cat: categorize(file, frontmatter)
    Cat->>Agent: executeSkill('process-meeting-note')
    
    Agent->>FS: loadIdentityContext()
    FS-->>Agent: [{ email: 'john@co.com', name: 'John Doe' }]
    
    Agent->>AI: chat({ transcript, identityContext })
    Note over AI: Claude Sonnet 4.5 processes<br/>transcript with context
    AI-->>Agent: { category: '1:1', person: 'john@co.com',<br/>confidence: 0.94, rationale: '...' }
    
    Agent-->>Cat: CategorizationResult
    Cat-->>Inbox: CategorizationResult
    
    Inbox->>Route: route(file, result)
    Route->>Route: checkConfidence(0.94)
    Note over Route: 0.94 > 0.75 threshold<br/>Auto-approve
    Route-->>Inbox: RoutingDecision (approved)
    
    Inbox->>FS: moveFile('inbox/1on1-john.md',<br/>'my-teams/alpha/john@co.com/1on1s/2026-02-20.md')
    
    Inbox->>CTX: appendContext(path, entry)
    CTX->>FS: appendFile('my-teams/.../context.md', entry)
    CTX->>CTX: checkFileSize(path)
    
    Inbox->>Task: appendToTaskFile(tasks, 'this-week')
    Task->>FS: appendFile('my-tasks/this-week.md', tasks)
    
    Inbox->>FS: moveFile('inbox/1on1-john.md',<br/>'archive/2026/02/inbox/1on1-john.md')
    Inbox->>FS: appendFrontmatter(archived file, metadata)
    
    Inbox-->>CLI: ProcessResult
    CLI->>User: ✅ Processed 1 file<br/>📁 my-teams/alpha/john@co.com/1on1s/<br/>Confidence: 0.94<br/>📝 2 tasks extracted
```

---

## Workflow 3: Inbox Processing with Low Confidence (User Confirmation)

This sequence shows human-in-the-loop processing when AI categorization confidence is below threshold.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Dispatcher
    participant Inbox as Inbox Processor
    participant Cat as Categorization Service
    participant AI as AI Provider
    participant Route as Routing Engine
    participant FS as File System Repository

    User->>CLI: tmr process
    CLI->>Inbox: processInbox()
    
    Inbox->>FS: listFiles('inbox/')
    FS-->>Inbox: ['inbox/meeting-notes.md']
    
    Inbox->>FS: readFile('inbox/meeting-notes.md')
    FS-->>Inbox: content (no clear frontmatter)
    
    Inbox->>Cat: categorize(file, frontmatter)
    Cat->>AI: categorize({ transcript })
    AI-->>Cat: { category: 'project', project: 'api-redesign',<br/>confidence: 0.62, rationale: 'Ambiguous: could be<br/>project or company meeting' }
    
    Cat-->>Inbox: CategorizationResult
    
    Inbox->>Route: route(file, result)
    Route->>Route: checkConfidence(0.62)
    Note over Route: 0.62 < 0.75 threshold<br/>Requires confirmation
    
    Route->>User: ⚠️ Low confidence (62%)<br/>Proposed: my-projects/api-redesign/<br/>Rationale: Meeting discusses API endpoints<br/><br/>Options:<br/>1. Accept<br/>2. Route to different location<br/>3. Skip this file
    
    User->>Route: 1 (Accept)
    Route-->>Inbox: RoutingDecision (user-approved)
    
    Inbox->>FS: moveFile('inbox/meeting-notes.md',<br/>'my-projects/api-redesign/meetings/2026-02-20.md')
    
    Note over Inbox: Continue with context update,<br/>task extraction, archiving...
    
    Inbox-->>CLI: ProcessResult
    CLI->>User: ✅ Processed 1 file (user confirmed)<br/>📁 my-projects/api-redesign/meetings/
```

---

## Workflow 4: Agent Command Execution (`*1on1-prepare`)

This sequence shows how specialized agent commands work with pre-loaded context.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Dispatcher
    participant Agent as Agent Orchestrator
    participant FS as File System Repository
    participant AI as AI Provider (Claude)

    User->>CLI: tmr people *1on1-prepare john.doe@company.com
    CLI->>Agent: executeAgentCommand('tmr-people',<br/>'*1on1-prepare', ['john.doe@company.com'])
    
    Agent->>Agent: loadAgent('tmr-people')
    Note over Agent: Load BMAD agent definition
    
    Agent->>FS: readFile('my-teams/.../john.doe@company.com/profile.md')
    FS-->>Agent: Profile data
    
    Agent->>FS: readFile('my-teams/.../john.doe@company.com/context.md')
    FS-->>Agent: Recent context entries
    
    Agent->>FS: readFile('my-teams/.../john.doe@company.com/pdp.md')
    FS-->>Agent: Personal Development Plan
    
    Agent->>FS: listFiles('my-teams/.../john.doe@company.com/1on1s/')
    FS-->>Agent: ['2026-02-13.md', '2026-02-06.md']
    
    Agent->>FS: readFile('my-teams/.../john.doe@company.com/1on1s/2026-02-13.md')
    FS-->>Agent: Last 1:1 notes
    
    Agent->>Agent: buildPrompt('1on1-prepare', loadedContext)
    Note over Agent: BMAD agent constructs<br/>specialized prompt
    
    Agent->>AI: generateAgentResponse(prompt, agentConfig)
    Note over AI: Claude generates 1:1 agenda<br/>based on full context
    AI-->>Agent: Formatted 1:1 agenda with:<br/>- Recent achievements<br/>- PDP progress<br/>- Topics to discuss<br/>- Questions for John
    
    Agent-->>CLI: Formatted agenda (markdown)
    CLI->>User: 📋 1:1 Agenda for John Doe<br/><br/>Recent Achievements:<br/>- Completed API refactor milestone<br/>- Mentored 2 junior developers<br/><br/>PDP Progress:<br/>- Tech lead goal: On track...<br/><br/>Topics to Discuss:<br/>1. Career growth conversation...<br/><br/>Questions for John:<br/>- How are you feeling about...
    
    Note over User: User can save this to<br/>upcoming 1:1 file or<br/>use as talking points
```

---

## Workflow 5: AI Provider Switching

This sequence shows how users can switch between AI providers at runtime.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Dispatcher
    participant Config as Config Service
    participant AI as AI Provider Abstraction

    User->>CLI: tmr config set-active-provider gemini
    CLI->>Config: setActiveProvider('gemini')
    
    Config->>Config: validateProvider('gemini')
    alt Provider exists in config
        Config->>Config: updateConfig({ active_provider: 'gemini' })
        Config-->>CLI: Success
        CLI->>User: ✅ Active provider switched to Gemini<br/>Model: gemini-2.5-flash<br/>Context window: 1M tokens
    else Provider not configured
        Config-->>CLI: Error: Provider not found
        CLI->>User: ❌ Gemini not configured.<br/>Run: tmr config add-provider gemini
        User->>CLI: tmr config add-provider gemini
        CLI->>Config: addProvider('gemini')
        Config->>User: Enter Gemini API key:
        User->>Config: AIza***
        Config->>AI: validateApiKey('gemini', key)
        AI-->>Config: Valid
        Config->>Config: saveProvider({ name: 'gemini',<br/>apiKey: encrypted, model: 'gemini-2.5-flash' })
        Config-->>CLI: Success
        CLI->>User: ✅ Gemini configured and activated
    end
    
    Note over User: Next tmr process will use Gemini
```

---

## Workflow 6: Error Handling - AI Provider Failure

This sequence shows graceful degradation when an AI provider is unavailable.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Dispatcher
    participant Inbox as Inbox Processor
    participant Cat as Categorization Service
    participant AI as AI Provider
    participant Config as Config Service

    User->>CLI: tmr process
    CLI->>Inbox: processInbox()
    Inbox->>Cat: categorize(file, frontmatter)
    Cat->>AI: chat({ transcript })
    
    AI->>AI: ClaudeProvider.chat()
    Note over AI: API call to Claude
    AI-->>AI: Error: 529 (Overloaded)
    
    AI->>AI: retryWithBackoff(attempt 1)
    Note over AI: Wait 1s, retry
    AI-->>AI: Error: 529 (Overloaded)
    
    AI->>AI: retryWithBackoff(attempt 2)
    Note over AI: Wait 2s, retry
    AI-->>AI: Error: 529 (Overloaded)
    
    AI->>AI: retryWithBackoff(attempt 3)
    Note over AI: Wait 4s, retry
    AI-->>AI: Error: 529 (Overloaded)
    
    AI-->>Cat: Error: Max retries exceeded
    Cat-->>Inbox: Error
    Inbox-->>CLI: ProcessError
    
    CLI->>User: ❌ Processing failed: Claude API unavailable<br/><br/>Options:<br/>1. Try again later<br/>2. Switch to different provider:<br/>   tmr config set-active-provider gemini<br/>3. Configure backup provider:<br/>   tmr config add-provider openai
    
    User->>CLI: tmr config set-active-provider gemini
    CLI->>Config: setActiveProvider('gemini')
    Config-->>CLI: Success
    
    User->>CLI: tmr process
    Note over CLI,AI: Processing resumes with Gemini
    CLI->>User: ✅ Processed successfully with Gemini
```

---
