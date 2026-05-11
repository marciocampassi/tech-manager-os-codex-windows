/**
 * Reusable test data builders for MemberService.addMember() tests (Story 3.2).
 * Covers email, team, and location variants used across unit and integration tests.
 */

export const MEMBER_WS = '/fake/workspace';

export const COMPANY_EMAIL = 'joao@company.com';
export const TEAM_EMAIL = 'ana@company.com';

/**
 * Returns the expected flat profile path for a given scope.
 * - company scope: my-company/members/<email>.md
 * - team scope:    my-teams/members/<email>.md
 */
export function memberProfilePath(ws: string, email: string, scope: 'company' | 'team'): string {
  return scope === 'company'
    ? `${ws}/my-company/members/${email}.md`
    : `${ws}/my-teams/members/${email}.md`;
}

export const baseOpts = {
  name: 'Joao Silva',
  role: 'Engineer',
  gender: 'M',
  location: '',
};

export function teamOpts(team = 'backend'): typeof baseOpts & { team: string } {
  return { ...baseOpts, team };
}

export function withLocation(location: string): typeof baseOpts & { location: string } {
  return { ...baseOpts, location };
}
