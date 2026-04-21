/**
 * Unit tests for onboarding.prompts.ts
 *
 * All exported prompt functions are covered. `inquirer` is fully mocked so no
 * real terminal interaction occurs. `process.stdout.write` is silenced during
 * tests that call informational banners.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockPrompt = jest.fn<() => Promise<Record<string, unknown>>>();

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const {
  promptWorkspacePath,
  promptProviderSelection,
  promptApiKey,
  promptManagerProfile,
  promptLeadershipContext,
  promptTeamMembers,
  promptMinimalOnboarding,
  promptGoogleDriveSetup,
} = await import('../../src/workflows/onboarding.prompts.js');

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('onboarding.prompts', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  // ── promptWorkspacePath ───────────────────────────────────────────────────

  describe('promptWorkspacePath', () => {
    it('returns the raw path when no tilde prefix', async () => {
      mockPrompt.mockResolvedValueOnce({ workspacePath: '/absolute/path' });
      const result = await promptWorkspacePath();
      expect(result).toBe('/absolute/path');
    });

    it('expands ~/… to homedir() + path segment', async () => {
      mockPrompt.mockResolvedValueOnce({ workspacePath: '~/tech-workspace' });
      const result = await promptWorkspacePath();
      expect(result).toBe(join(homedir(), 'tech-workspace'));
    });

    it('calls inquirer.prompt once', async () => {
      mockPrompt.mockResolvedValueOnce({ workspacePath: '/tmp/ws' });
      await promptWorkspacePath();
      expect(mockPrompt).toHaveBeenCalledTimes(1);
    });
  });

  // ── promptProviderSelection ───────────────────────────────────────────────

  describe('promptProviderSelection', () => {
    it('returns the selected provider', async () => {
      mockPrompt.mockResolvedValueOnce({ provider: 'gemini' });
      const result = await promptProviderSelection();
      expect(result).toBe('gemini');
    });

    it('writes API key doc URLs to stdout before prompting', async () => {
      mockPrompt.mockResolvedValueOnce({ provider: 'openai' });
      await promptProviderSelection();
      const calls = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]);
      expect(calls.some((s) => s.includes('Gemini'))).toBe(true);
      expect(calls.some((s) => s.includes('OpenAI'))).toBe(true);
      expect(calls.some((s) => s.includes('Claude'))).toBe(true);
    });

    it('returns "claude" when Anthropic is selected', async () => {
      mockPrompt.mockResolvedValueOnce({ provider: 'claude' });
      const result = await promptProviderSelection();
      expect(result).toBe('claude');
    });
  });

  // ── promptApiKey ──────────────────────────────────────────────────────────

  describe('promptApiKey', () => {
    it('returns the entered API key', async () => {
      mockPrompt.mockResolvedValueOnce({ apiKey: 'sk-test-key-abc' });
      const result = await promptApiKey('openai');
      expect(result).toBe('sk-test-key-abc');
    });

    it('does not include attempt suffix when maxAttempts is 1', async () => {
      mockPrompt.mockResolvedValueOnce({ apiKey: 'key123' });
      await promptApiKey('gemini', 1, 1);
      const calls = mockPrompt.mock.calls as unknown[][];
      const questions = calls[0][0] as { message: string }[];
      expect(questions[0].message).not.toContain('attempt');
    });

    it('includes attempt suffix when maxAttempts > 1', async () => {
      mockPrompt.mockResolvedValueOnce({ apiKey: 'key123' });
      await promptApiKey('gemini', 2, 3);
      const calls = mockPrompt.mock.calls as unknown[][];
      const questions = calls[0][0] as { message: string }[];
      expect(questions[0].message).toContain('attempt 2/3');
    });
  });

  // ── promptManagerProfile ──────────────────────────────────────────────────

  describe('promptManagerProfile', () => {
    it('returns a profile with all fields when location is provided', async () => {
      mockPrompt.mockResolvedValueOnce({
        name: 'Alice Manager',
        email: 'alice@co.com',
        role: 'Engineering Manager',
        location: 'São Paulo',
      });
      const result = await promptManagerProfile();
      expect(result).toEqual({
        name: 'Alice Manager',
        email: 'alice@co.com',
        role: 'Engineering Manager',
        location: 'São Paulo',
      });
    });

    it('omits location key when location is empty string', async () => {
      mockPrompt.mockResolvedValueOnce({
        name: 'Bob Dev',
        email: 'bob@co.com',
        role: 'Senior Engineer',
        location: '',
      });
      const result = await promptManagerProfile();
      expect(result).toEqual({ name: 'Bob Dev', email: 'bob@co.com', role: 'Senior Engineer' });
      expect('location' in result).toBe(false);
    });

    it('trims whitespace from location', async () => {
      mockPrompt.mockResolvedValueOnce({
        name: 'Carol',
        email: 'carol@co.com',
        role: 'Tech Lead',
        location: '  Berlin  ',
      });
      const result = await promptManagerProfile();
      expect(result.location).toBe('Berlin');
    });
  });

  // ── promptLeadershipContext ───────────────────────────────────────────────

  describe('promptLeadershipContext', () => {
    it('returns manager name and email', async () => {
      mockPrompt.mockResolvedValueOnce({
        managerName: 'Director Dan',
        managerEmail: 'dan@co.com',
      });
      const result = await promptLeadershipContext();
      expect(result).toEqual({ managerName: 'Director Dan', managerEmail: 'dan@co.com' });
    });
  });

  // ── promptTeamMembers ─────────────────────────────────────────────────────

  describe('promptTeamMembers', () => {
    it('returns empty array when first email prompt is empty', async () => {
      mockPrompt.mockResolvedValueOnce({ email: '' });
      const result = await promptTeamMembers();
      expect(result).toEqual([]);
    });

    it('returns one member when a single member is added then loop exited', async () => {
      mockPrompt
        .mockResolvedValueOnce({ email: 'alice@co.com' })
        .mockResolvedValueOnce({ name: 'Alice', gender: 'Female', role: 'Engineer', location: '' })
        .mockResolvedValueOnce({ email: '' });
      const result = await promptTeamMembers();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        email: 'alice@co.com',
        name: 'Alice',
        gender: 'Female',
        role: 'Engineer',
      });
    });

    it('returns two members when two valid members added before exiting', async () => {
      mockPrompt
        .mockResolvedValueOnce({ email: 'alice@co.com' })
        .mockResolvedValueOnce({ name: 'Alice', gender: 'Female', role: 'Engineer', location: '' })
        .mockResolvedValueOnce({ email: 'bob@co.com' })
        .mockResolvedValueOnce({ name: 'Bob', gender: 'Male', role: 'Designer', location: 'NYC' })
        .mockResolvedValueOnce({ email: '' });
      const result = await promptTeamMembers();
      expect(result).toHaveLength(2);
      expect(result[1].location).toBe('NYC');
    });

    it('skips duplicate emails and writes a warning to stdout', async () => {
      mockPrompt
        .mockResolvedValueOnce({ email: 'alice@co.com' })
        .mockResolvedValueOnce({ name: 'Alice', gender: 'Female', role: 'Engineer', location: '' })
        .mockResolvedValueOnce({ email: 'alice@co.com' }) // duplicate
        .mockResolvedValueOnce({ email: '' });
      const result = await promptTeamMembers();
      expect(result).toHaveLength(1);
      const calls = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]);
      expect(calls.some((s) => s.includes('already added'))).toBe(true);
    });

    it('includes location when location is provided', async () => {
      mockPrompt
        .mockResolvedValueOnce({ email: 'charlie@co.com' })
        .mockResolvedValueOnce({ name: 'Charlie', gender: 'Male', role: 'PM', location: 'Berlin' })
        .mockResolvedValueOnce({ email: '' });
      const result = await promptTeamMembers();
      expect(result[0].location).toBe('Berlin');
    });

    it('writes prompt instruction to stdout before asking for first email', async () => {
      mockPrompt.mockResolvedValueOnce({ email: '' });
      await promptTeamMembers();
      const calls = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]);
      expect(calls.some((s) => s.includes('team members'))).toBe(true);
    });
  });

  // ── promptMinimalOnboarding ───────────────────────────────────────────────

  describe('promptMinimalOnboarding', () => {
    it('returns all four fields', async () => {
      mockPrompt.mockResolvedValueOnce({
        name: 'Alice Manager',
        email: 'alice@example.com',
        role: 'Engineering Manager',
        company: 'example.com',
      });
      const result = await promptMinimalOnboarding();
      expect(result).toEqual({
        name: 'Alice Manager',
        email: 'alice@example.com',
        role: 'Engineering Manager',
        company: 'example.com',
      });
    });
  });

  // ── promptGoogleDriveSetup ────────────────────────────────────────────────

  describe('promptGoogleDriveSetup', () => {
    it('returns disabled result when user declines Google Drive setup', async () => {
      mockPrompt.mockResolvedValueOnce({ enabled: false });
      const result = await promptGoogleDriveSetup();
      expect(result).toEqual({ enabled: false, folderDriveId: '', clientId: '', clientSecret: '' });
    });

    it('returns credentials when user enables Google Drive setup', async () => {
      mockPrompt.mockResolvedValueOnce({ enabled: true }).mockResolvedValueOnce({
        folderDriveId: 'drive-folder-xyz',
        clientId: 'client-id-abc',
        clientSecret: 'secret-123',
      });
      const result = await promptGoogleDriveSetup();
      expect(result).toEqual({
        enabled: true,
        folderDriveId: 'drive-folder-xyz',
        clientId: 'client-id-abc',
        clientSecret: 'secret-123',
      });
    });

    it('writes setup banner and OAuth URL to stdout when enabled', async () => {
      mockPrompt
        .mockResolvedValueOnce({ enabled: true })
        .mockResolvedValueOnce({ folderDriveId: 'f', clientId: 'c', clientSecret: 's' });
      await promptGoogleDriveSetup();
      const calls = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]);
      expect(calls.some((s) => s.includes('Google'))).toBe(true);
    });

    it('does not call prompt a second time when disabled', async () => {
      mockPrompt.mockResolvedValueOnce({ enabled: false });
      await promptGoogleDriveSetup();
      expect(mockPrompt).toHaveBeenCalledTimes(1);
    });
  });
});
