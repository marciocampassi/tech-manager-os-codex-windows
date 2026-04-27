# Test Strategy and Standards

## Testing Philosophy

- **Approach:** Test-Driven Development (TDD) for core business logic, test-after for UI/CLI
- **Coverage Goals:** 
  - Core packages: 90% coverage
  - CLI commands: 70% coverage
  - Overall: 80% minimum
- **Test Pyramid:** 70% unit tests, 20% integration tests, 10% end-to-end tests

## Test Types and Organization

### Unit Tests

- **Framework:** Vitest 1.x
- **File Convention:** `{source-file}.test.ts` (e.g., `inbox-processor.test.ts`)
- **Location:** `packages/{package}/tests/unit/`
- **Mocking Library:** Vitest built-in mocks
- **Coverage Requirement:** 90% for core business logic

**AI Agent Requirements:**
- Generate tests for all public methods and functions
- Cover edge cases and error conditions (invalid inputs, network failures, etc.)
- Follow AAA pattern (Arrange, Act, Assert)
- Mock all external dependencies (file system, AI providers, config)
- Use descriptive test names: `it('should extract tasks from categorization result')`

**Example:**
```typescript
describe('InboxProcessor', () => {
  it('should process high-confidence categorization automatically', async () => {
    // Arrange
    const mockFS = createMockFileSystem();
    const mockAI = createMockAIProvider({ confidence: 0.92 });
    const processor = new InboxProcessor(mockFS, mockAI);
    
    // Act
    const result = await processor.processInbox();
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.filesProcessed).toBe(1);
    expect(mockFS.moveFile).toHaveBeenCalledWith(
      'inbox/test.md',
      'my-teams/alpha/john@co.com/1on1s/2026-02-20.md'
    );
  });
});
```

### Integration Tests

- **Scope:** Cross-package interactions, file system operations, AI provider integration
- **Location:** `packages/{package}/tests/integration/`
- **Test Infrastructure:**
  - **File System:** Use temp directories (`os.tmpdir()`) with cleanup
  - **AI Providers:** Use mock servers or test API keys with rate limiting
  - **Configuration:** Use test-specific config files

**Example:**
```typescript
describe('End-to-End Inbox Processing', () => {
  let testWorkspace: string;
  
  beforeEach(() => {
    testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-test-'));
  });
  
  afterEach(() => {
    fs.rmSync(testWorkspace, { recursive: true });
  });
  
  it('should process transcript from inbox to team folder', async () => {
    // Setup workspace structure
    setupTestWorkspace(testWorkspace);
    
    // Write test transcript
    const transcript = createTestTranscript();
    fs.writeFileSync(`${testWorkspace}/inbox/test.md`, transcript);
    
    // Execute
    const processor = new InboxProcessor({ workspace: testWorkspace });
    await processor.processInbox();
    
    // Verify file moved
    expect(fs.existsSync(`${testWorkspace}/my-teams/alpha/john@co.com/1on1s/2026-02-20.md`)).toBe(true);
    
    // Verify context updated
    const context = fs.readFileSync(`${testWorkspace}/my-teams/alpha/john@co.com/context.md`, 'utf-8');
    expect(context).toContain('2026-02-20 | 1:1 Meeting');
  });
});
```

### End-to-End Tests

- **Framework:** Vitest with CLI execution
- **Scope:** Full command execution from CLI entry point
- **Environment:** Isolated test workspaces with mock AI providers
- **Test Data:** Fixtures in `tests/fixtures/`

## Test Data Management

- **Strategy:** Fixture files in `tests/fixtures/` directory
- **Fixtures:** Sample transcripts, profiles, context files with realistic data
- **Factories:** Test data factories for generating models
  ```typescript
  function createTestTeamMember(overrides?: Partial<TeamMember>): TeamMember {
    return {
      email: 'test@company.com',
      name: 'Test User',
      role: 'Engineer',
      team: 'alpha',
      status: 'active',
      ...overrides
    };
  }
  ```
- **Cleanup:** Automatic cleanup of test workspaces in `afterEach` hooks

## Continuous Testing

- **CI Integration:** Run tests on every push and pull request
- **Performance Tests:** Track command execution time, flag regressions >10%
- **Security Tests:** Dependency vulnerability scanning via `npm audit` in CI

---
