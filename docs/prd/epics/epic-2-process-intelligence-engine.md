# Epic 2: Process Intelligence Engine

**Expanded Goal:** Build the AI-powered cycle agent that powers the `tmr process` command to process inbox files, categorizes them by type and entity, updates context summaries using intelligent merging, extracts actionable tasks with urgency classification, and moves files to appropriate destinations. This epic delivers the core "transcript-to-context" value proposition.

## Story 2.1: Inbox Scanner and File Parser

**As a** developer,  
**I want** to scan and parse inbox files efficiently,  
**so that** the process command can handle them.

**Acceptance Criteria:**

1. `InboxService` class with methods: `scanInbox()`, `parseFile()`
2. Supports file types: `.txt`, `.md`, `.json`
3. Returns array of `InboxFile` objects with: filepath, content, timestamp
4. Handles edge cases: empty inbox, large files, malformed files
5. Sorted by timestamp (oldest first)
6. Unit tests cover various file types and scenarios

## Story 2.2: AI-Powered Categorization Logic

**As a** manager,  
**I want** notes automatically categorized and filed,  
**so that** I don't have to manually organize everything.

**Acceptance Criteria:**

1. `CategorizationService` class with method: `categorize(file, context)`
2. AI prompt analyzes file and returns structured JSON:
   - Type: `1on1_session`, `feedback_positive`, `feedback_constructive`, `pip_concern`, `project_status`, `project_risk`, `team_meeting`, `leadership_meeting`, `candidate_interview`, `general_note`
   - Members: Array of member names mentioned
   - Projects: Array of project names mentioned
   - Insights: Key points for each entity
   - Destinations: Array of file paths
   - Suggested actions: Follow-up items
3. Handles ambiguous cases (low confidence triggers review)
4. Unit tests with mocked AI responses
5. Integration test with real file samples

## Story 2.3: Context Summary Merging

**As a** manager,  
**I want** context summaries intelligently updated with new information,  
**so that** I have current, accurate context for each person/project.

**Acceptance Criteria:**

1. `ContextService` class with method: `updateContext(entityPath, existingContext, newInsights)`
2. AI prompt merges new insights with existing context:
   - Preserves important historical information
   - Updates with new information
   - Maintains chronological awareness
   - Highlights changes in behavior/status
3. Handles first-time context creation
4. Prevents context from growing unbounded (summarization strategy)
5. Unit tests with various merge scenarios

## Story 2.4: Task Extraction and Timeline Classification

**As a** manager,  
**I want** actionable tasks extracted and classified by urgency,  
**so that** I know what needs attention today vs. this week vs. later.

**Acceptance Criteria:**

1. `TaskService` class with method: `extractTasks(files, existingTasks)`
2. AI identifies tasks and classifies:
   - TODAY: Urgent, "ASAP", explicit today deadline
   - THIS WEEK: "This week", "by Friday", week deadlines
   - THIS MONTH: Monthly goals, month deadlines
   - THIS QUARTER: Quarterly objectives
3. Each task includes: description, owner, urgency reason, status
4. Updates existing task files (merges with current tasks)
5. Marks completed tasks based on mentions
6. Unit tests with task extraction scenarios

## Story 2.5: File Organization and Movement

**As a** developer,  
**I want** files moved to correct destinations after categorization,  
**so that** the workspace stays organized.

**Acceptance Criteria:**

1. `FileOrganizationService` with method: `organizeFile(file, destinations)`
2. Moves files from inbox to destination(s)
3. Creates destination directories if needed
4. Handles multi-destination cases (copy to multiple locations)
5. Archives unprocessable files to `archive/`
6. Atomic operations (no data loss)
7. Unit tests cover various organization scenarios

## Story 2.6: `tmr process` Command Implementation

**As a** leader,  
**I want** one command to process all inbox files,  
**so that** my workspace stays current with minimal effort.

**Acceptance Criteria:**

1. `tmr process` orchestrates: Scan → Categorize → Update Contexts → Extract Tasks → Organize Files
2. Progress indicators for each phase
3. Summary output:
   - Files processed
   - Contexts updated (people, projects)
   - Tasks extracted
   - Suggested actions
4. Handles errors gracefully (partial progress saved)
5. Optional flags: `--dry-run`, `--verbose`
6. Integration test validates full process workflow

## Story 2.7: `tmr watch` Command for Auto-Processing

**As a** leader,  
**I want** inbox to be processed automatically when files are added,  
**so that** I don't have to remember to run process.

**Acceptance Criteria:**

1. `tmr watch` monitors `inbox/` directory
2. Uses `chokidar` for file watching
3. Debounces multiple file additions (waits 5 seconds)
4. Runs `tmr process` automatically
5. Displays activity log
6. Can be stopped with Ctrl+C
7. Stores PID in `.system/watch.pid`
8. Integration test validates file watching

---
