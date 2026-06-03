/**
 * Fixture helper for `tmr init` integration and unit tests.
 *
 * `applyInitPromptFixture` wires a Jest mock of `inquirer.prompt` with the
 * correct sequence of resolved values for a given scenario so callers do not
 * have to manually chain `mockResolvedValueOnce` calls.
 *
 * Prompt call order for the full happy-path (Story 9.4 split: 12 calls total):
 *   1.  promptWorkspacePath            → { workspacePath }
 *   2.  promptNameAndEmail             → { name, email }
 *   3.  promptAdditionalDomains        → { raw: '' }  (skip — no extra domains)
 *   4.  promptRoleAndCompany           → { role, company }
 *   5.  promptLeaderDetails            → { name, email, role, location }
 *   6.  promptTeamCount                → { teamCount: '2' }
 *   7.  promptTeamName(1)              → { teamName: TEAM_1 }
 *   8.  promptTeamName(2)              → { teamName: TEAM_2 }
 *   9.  promptMemberEmail(TEAM_1)      → { memberEmail: MEMBER_1_EMAIL }
 *   10. promptMemberDetails()          → { name, role, gender, location }
 *   11. promptMemberEmail(TEAM_1)      → { memberEmail: '' }  (end loop)
 *   12. promptMemberEmail(TEAM_2)      → { memberEmail: '' }  (end loop)
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
  MEMBER_1_EMAIL: 'backend-member@example.com',
  MEMBER_1_NAME: 'Backend Engineer',
  MEMBER_1_ROLE: 'Software Engineer',
  MEMBER_1_GENDER: 'non-binary',
  MEMBER_1_LOCATION: 'Remote',
} as const;

// ── Scenario type ──────────────────────────────────────────────────────────────

export type InitPromptScenario =
  | 'happy-path'
  | 'email-error-recovery'
  | 'zero-team-count'
  | 'member-email-error';

// ── Fixture function ──────────────────────────────────────────────────────────

type PromptMockFn = jest.MockedFunction<() => Promise<Record<string, unknown>>>;

/**
 * Applies pre-wired mock sequences to the provided `inquirer.prompt` mock.
 *
 * - `'happy-path'`: full 12-call sequence covering the entire `tmr init` flow
 *   (incl. member collection for 2 teams: 1 member on Team 1, 0 on Team 2).
 *   Safe to use in integration and command-level tests.
 *
 * - `'email-error-recovery'`: **partial sequence** — 2 calls only (invalid then
 *   valid `promptMinimalOnboarding`). Designed for unit tests that call
 *   `promptMinimalOnboarding()` in isolation to verify recovery logic.
 *   DO NOT use this scenario in a full `InitCommand.run()` test — the remaining
 *   prompt calls (workspace, leader, teams, members) will return `undefined` and throw.
 *   Note: because `inquirer.prompt` itself is mocked, Inquirer's `validate`
 *   callbacks are bypassed; test the validate closures as pure functions directly.
 *
 * - `'zero-team-count'`: **partial sequence** — 2 calls only (invalid `'0'` then
 *   valid `'2'` for `promptTeamCount`). Same restrictions as `email-error-recovery`.
 *   DO NOT use in a full `InitCommand.run()` test.
 *
 * - `'member-email-error'`: **partial sequence** — 2 calls only (invalid email then
 *   valid email for `promptMemberEmail`). For prompt unit tests verifying email
 *   validation. DO NOT use in a full `InitCommand.run()` test.
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
    MEMBER_1_EMAIL,
    MEMBER_1_NAME,
    MEMBER_1_ROLE,
    MEMBER_1_GENDER,
    MEMBER_1_LOCATION,
  } = FIXTURE_DATA;

  switch (scenario) {
    case 'happy-path':
      mockFn
        // 1. promptWorkspacePath
        .mockResolvedValueOnce({ workspacePath: WORKSPACE })
        // 2. promptNameAndEmail
        .mockResolvedValueOnce({ name: USER_NAME, email: USER_EMAIL })
        // 3. promptAdditionalDomains — press Enter to skip (no extra domains)
        .mockResolvedValueOnce({ raw: '' })
        // 4. promptRoleAndCompany
        .mockResolvedValueOnce({ role: USER_ROLE, company: USER_COMPANY })
        // 5. promptLeaderDetails
        .mockResolvedValueOnce({
          name: LEADER_NAME,
          email: LEADER_EMAIL,
          role: LEADER_ROLE,
          location: '',
        })
        // 6. promptTeamCount (returns string; parseInt() happens inside promptTeamCount)
        .mockResolvedValueOnce({ teamCount: '2' })
        // 7. promptTeamName(1)
        .mockResolvedValueOnce({ teamName: TEAM_1 })
        // 8. promptTeamName(2)
        .mockResolvedValueOnce({ teamName: TEAM_2 })
        // 9. promptMemberEmail(TEAM_1) — first member
        .mockResolvedValueOnce({ memberEmail: MEMBER_1_EMAIL })
        // 10. promptMemberDetails() — details for MEMBER_1
        .mockResolvedValueOnce({
          name: MEMBER_1_NAME,
          role: MEMBER_1_ROLE,
          gender: MEMBER_1_GENDER,
          location: MEMBER_1_LOCATION,
        })
        // 11. promptMemberEmail(TEAM_1) — empty → end loop for Team 1
        .mockResolvedValueOnce({ memberEmail: '' })
        // 12. promptMemberEmail(TEAM_2) — empty → end loop for Team 2
        .mockResolvedValueOnce({ memberEmail: '' });
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

    case 'member-email-error':
      // Two back-to-back promptMemberEmail calls; first returns a bad email,
      // second returns MEMBER_1_EMAIL. For prompt unit tests verifying validation.
      mockFn
        .mockResolvedValueOnce({ memberEmail: 'bad-email' })
        .mockResolvedValueOnce({ memberEmail: MEMBER_1_EMAIL });
      break;
  }
}
