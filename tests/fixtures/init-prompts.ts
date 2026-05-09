/**
 * Fixture helper for `tmr init` integration and unit tests.
 *
 * `applyInitPromptFixture` wires a Jest mock of `inquirer.prompt` with the
 * correct sequence of resolved values for a given scenario so callers do not
 * have to manually chain `mockResolvedValueOnce` calls.
 *
 * Prompt call order for the full happy-path (Story 2.2):
 *   1. promptWorkspacePath       → { workspacePath }
 *   2. promptMinimalOnboarding   → { name, email, role, company }
 *   3. promptLeaderDetails       → { name, email, role }
 *   4. promptTeamCount           → { teamCount: '2' }
 *   5. promptTeamName(1)         → { teamName: TEAM_1 }
 *   6. promptTeamName(2)         → { teamName: TEAM_2 }
 */

// ── Shared fixture constants ───────────────────────────────────────────────────

export const FIXTURE_DATA = {
  WORKSPACE: '/tmp/integration-test-workspace',
  USER_NAME: 'Integration User',
  USER_EMAIL: 'integration@example.com',
  USER_ROLE: 'Senior Engineering Manager',
  USER_COMPANY: 'example.com',
  LEADER_NAME: 'Director Leader',
  LEADER_EMAIL: 'director@example.com',
  LEADER_ROLE: 'Engineering Director',
  TEAM_1: 'Backend Team',
  TEAM_2: 'Frontend Team',
} as const;

// ── Scenario type ──────────────────────────────────────────────────────────────

export type InitPromptScenario = 'happy-path' | 'email-error-recovery' | 'zero-team-count';

// ── Fixture function ──────────────────────────────────────────────────────────

type PromptMockFn = jest.MockedFunction<() => Promise<Record<string, unknown>>>;

/**
 * Applies pre-wired mock sequences to the provided `inquirer.prompt` mock.
 *
 * - `'happy-path'`: full 6-call sequence covering the entire `tmr init` flow;
 *   safe to use in integration and command-level tests.
 *
 * - `'email-error-recovery'`: **partial sequence** — 2 calls only (invalid then
 *   valid `promptMinimalOnboarding`). Designed for unit tests that call
 *   `promptMinimalOnboarding()` in isolation to verify recovery logic.
 *   DO NOT use this scenario in a full `InitCommand.run()` test — the remaining
 *   prompt calls (workspace, leader, teams) will return `undefined` and throw.
 *   Note: because `inquirer.prompt` itself is mocked, Inquirer's `validate`
 *   callbacks are bypassed; test the validate closures as pure functions directly.
 *
 * - `'zero-team-count'`: **partial sequence** — 2 calls only (invalid `'0'` then
 *   valid `'2'` for `promptTeamCount`). Same restrictions as `email-error-recovery`.
 *   DO NOT use in a full `InitCommand.run()` test.
 */
export function applyInitPromptFixture(scenario: InitPromptScenario, mockFn: PromptMockFn): void {
  const {
    WORKSPACE,
    USER_NAME,
    USER_EMAIL,
    USER_ROLE,
    USER_COMPANY,
    LEADER_NAME,
    LEADER_EMAIL,
    LEADER_ROLE,
    TEAM_1,
    TEAM_2,
  } = FIXTURE_DATA;

  switch (scenario) {
    case 'happy-path':
      mockFn
        // 1. promptWorkspacePath
        .mockResolvedValueOnce({ workspacePath: WORKSPACE })
        // 2. promptMinimalOnboarding
        .mockResolvedValueOnce({
          name: USER_NAME,
          email: USER_EMAIL,
          role: USER_ROLE,
          company: USER_COMPANY,
        })
        // 3. promptLeaderDetails
        .mockResolvedValueOnce({ name: LEADER_NAME, email: LEADER_EMAIL, role: LEADER_ROLE })
        // 4. promptTeamCount (returns string; parseInt() happens inside promptTeamCount)
        .mockResolvedValueOnce({ teamCount: '2' })
        // 5. promptTeamName(1)
        .mockResolvedValueOnce({ teamName: TEAM_1 })
        // 6. promptTeamName(2)
        .mockResolvedValueOnce({ teamName: TEAM_2 });
      break;

    case 'email-error-recovery':
      // Two back-to-back prompt calls; first has invalid email, second is valid.
      // Used to test that the validate function in promptMinimalOnboarding blocks
      // invalid emails (invoked directly in prompt unit tests, not integration).
      mockFn
        .mockResolvedValueOnce({
          name: USER_NAME,
          email: 'not-an-email',
          role: USER_ROLE,
          company: USER_COMPANY,
        })
        .mockResolvedValueOnce({
          name: USER_NAME,
          email: USER_EMAIL,
          role: USER_ROLE,
          company: USER_COMPANY,
        });
      break;

    case 'zero-team-count':
      // Two back-to-back promptTeamCount calls; first returns '0' (invalid),
      // second returns '2'. For prompt unit tests verifying validate rejection.
      mockFn.mockResolvedValueOnce({ teamCount: '0' }).mockResolvedValueOnce({ teamCount: '2' });
      break;
  }
}
