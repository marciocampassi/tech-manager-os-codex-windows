# Backlog: Onboarding Wizard — Extended Profile Collection

> **Tipo:** Registro histórico / backlog deferido
> **Não pertence a nenhum épico.** Este documento registra campos temporariamente removidos do `tmr init` por decisão de produto. Quando houver decisão de implementar, deve ser formalizado como uma story no épico adequado.
> **Referência:** Sprint Change Proposal `docs/qa/change-proposals/2026-03-03-onboarding-refactor.md`

## Descrição

**Como** novo usuário executando `tmr init`,
**quero** fornecer meu perfil profissional completo durante o onboarding (experiência, estilo de gestão, pontos fortes, objetivos de carreira e expectativas da liderança),
**para que** o workspace seja pré-populado com contexto rico que os agentes dos Épicos 3–4 possam usar imediatamente.

## Context / Background

> **Why this story exists:**
> During Story 1.6 implementation, fields originally specified in ACs 5, 6, and 7 were temporarily removed from the `tmr init` wizard by product decision. The current wizard collects only: name, email, role, manager's name, and manager's email.
>
> The removed fields are intentionally deferred — not cancelled — and will be re-introduced once the downstream agents (Epics 3–4) that consume this data are closer to implementation. Capturing them at init only makes sense when there is a clear consumer ready to act on that data.
>
> **Fields currently deferred (to be re-added by this story):**
>
> | Field | Original AC | Type | Collected From |
> |-------|-------------|------|----------------|
> | `experienceYears` | AC 5 | number | `promptManagerProfile()` |
> | `managementStyle` | AC 5 | list (Servant/Directive/Coaching/Democratic/Transformational) | `promptManagerProfile()` |
> | `strengths` | AC 5 | comma-separated string → string[] | `promptManagerProfile()` |
> | `developmentAreas` | AC 5 | comma-separated string → string[] | `promptManagerProfile()` |
> | `shortTerm` | AC 6 | string | `promptCareerGoals()` |
> | `longTerm` | AC 6 | string | `promptCareerGoals()` |
> | `targetRole` | AC 6 | string | `promptCareerGoals()` |
> | `expectations` | AC 7 | string | `promptLeadershipContext()` |
>
> **Reference:** Sprint Change Proposal `docs/qa/change-proposals/2026-03-03-onboarding-refactor.md`

## Acceptance Criteria

1. `promptManagerProfile()` re-collects the full profile:
   - Name, email, current role (already collected — keep as-is)
   - Years of management experience (`experienceYears`, number, non-negative integer)
   - Primary management style (`managementStyle`, list: Servant / Directive / Coaching / Democratic / Transformational)
   - Key strengths (`strengths`, comma-separated input → `string[]`)
   - Development areas (`developmentAreas`, comma-separated input → `string[]`)
2. `promptCareerGoals()` re-introduced as a prompt step:
   - Short-term career goal — next 6 months (`shortTerm`)
   - Long-term career goal — 1–3 years (`longTerm`)
   - Target role (`targetRole`)
3. `promptLeadershipContext()` re-collects expectations:
   - Manager's name and email (already collected — keep as-is)
   - Key expectations from manager (`expectations`)
4. `ManagerProfile`, `CareerGoals`, and `LeadershipContext` types restored to their full original definitions in `src/types/onboarding.types.ts`
5. `OnboardingData` re-includes `careerGoals: CareerGoals`
6. `generateCareerProfile()` template re-emits `experience_years`, `leadership_style`, `strengths`, `development_areas` in frontmatter — matching the Leader Profile schema in `docs/prd/data-architecture.md`
7. `generatePdp()` template re-populates `## Career Goals` section with actual values (shortTerm, longTerm, targetRole) instead of placeholder text
8. `generateLeadershipProfile()` template re-adds `## Expectations` section populated from `leadershipContext.expectations`
9. All unit and integration tests updated to reflect the restored mock data sequence
10. Full test suite remains green (no regressions against Stories 1.1–1.6 tests)

## Tasks / Subtasks

- [ ] Task 1: Restore types (AC: 4, 5)
  - [ ] Add `experienceYears`, `managementStyle`, `strengths`, `developmentAreas` back to `ManagerProfile` interface
  - [ ] Restore `CareerGoals` interface: `shortTerm`, `longTerm`, `targetRole`
  - [ ] Add `expectations` back to `LeadershipContext` interface
  - [ ] Add `careerGoals: CareerGoals` back to `OnboardingData`

- [ ] Task 2: Restore prompts (AC: 1, 2, 3)
  - [ ] Add `experienceYears` (type `number`, validate non-negative integer) to `promptManagerProfile()`
  - [ ] Add `managementStyle` (type `list`) to `promptManagerProfile()`
  - [ ] Add `strengths` (type `input`, comma-split map) to `promptManagerProfile()`
  - [ ] Add `developmentAreas` (type `input`, comma-split map) to `promptManagerProfile()`
  - [ ] Re-introduce `promptCareerGoals(): Promise<CareerGoals>` with `shortTerm`, `longTerm`, `targetRole` inputs
  - [ ] Add `expectations` input back to `promptLeadershipContext()`

- [ ] Task 3: Restore templates (AC: 6, 7, 8)
  - [ ] Update `generateCareerProfile()` to emit `experience_years`, `leadership_style`, `strengths`, `development_areas` in YAML frontmatter and body
  - [ ] Update `generatePdp()` to populate `## Short-Term`, `## Long-Term`, `## Target Role` from `careerGoals`
  - [ ] Update `generateLeadershipProfile()` to re-add `## Expectations` section

- [ ] Task 4: Update init command orchestration (AC: 2)
  - [ ] Re-import and call `promptCareerGoals()` after `promptManagerProfile()`
  - [ ] Include `careerGoals` in the `OnboardingData` object passed to `writeWorkspaceFiles()`

- [ ] Task 5: Update tests (AC: 9, 10)
  - [ ] Restore mock data for `promptManagerProfile()` to include all fields
  - [ ] Add `promptCareerGoals()` mock call back to `setupHappyPath()` in unit and integration tests
  - [ ] Restore mock data for `promptLeadershipContext()` to include `expectations`
  - [ ] Verify `generateCareerProfile` integration test checks for `strengths` in frontmatter
  - [ ] Verify `generatePdp` integration test checks for actual goal text (not placeholder)
  - [ ] Run full suite — all tests green

- [ ] Task 6: Validate (AC: 10)
  - [ ] `npm run validate` → lint + typecheck + tests + build all pass

## Dev Notes

### Context from Story 1.6 (Previous Story Insights)

- All ESM patterns, mocking strategies, and module resolution rules from Story 1.6 apply unchanged.
- `jest.unstable_mockModule` required for all ESM mocks; `mockResolvedValueOnce` chaining for sequential prompt calls.
- The `ValidateResult = boolean | string` type alias in `onboarding.prompts.ts` should be reused for all new `validate` callbacks.
- `promptManagerProfile()` currently returns `{ name, email, role }` — this story extends it back to the full original shape.
- `promptCareerGoals()` was completely removed in the refactor; it must be re-created as a new exported function.
- `promptLeadershipContext()` currently returns `{ managerName, managerEmail }` — re-add `expectations` field.

### Files to Modify

```
src/
├── types/onboarding.types.ts          ← restore full interfaces
├── workflows/onboarding.prompts.ts    ← restore prompt fields + promptCareerGoals()
├── templates/onboarding.templates.ts  ← restore full template output
└── commands/init.command.ts           ← re-wire promptCareerGoals()

tests/
├── commands/init.command.test.ts      ← restore mock sequences
└── integration/init.integration.test.ts ← restore mock sequences + content assertions
```

### Prompt patterns to restore

```typescript
// In promptManagerProfile() — add after 'role':
{
  type: 'number',
  name: 'experienceYears',
  message: 'Years of management experience:',
  validate: (v: number): ValidateResult =>
    Number.isInteger(v) && v >= 0 ? true : 'Must be a non-negative integer',
},
{
  type: 'list',
  name: 'managementStyle',
  message: 'Your primary management style:',
  choices: ['Servant', 'Directive', 'Coaching', 'Democratic', 'Transformational'],
},
{
  type: 'input',
  name: 'strengths',
  message: 'Your key strengths (comma-separated):',
  validate: (v: string): ValidateResult =>
    v.trim().length > 0 ? true : 'Please enter at least one strength',
},
{
  type: 'input',
  name: 'developmentAreas',
  message: 'Your development areas (comma-separated):',
  validate: (v: string): ValidateResult =>
    v.trim().length > 0 ? true : 'Please enter at least one development area',
},

// promptCareerGoals() — restore as standalone export:
export async function promptCareerGoals(): Promise<CareerGoals> {
  const answers = await inquirer.prompt<CareerGoals>([
    { type: 'input', name: 'shortTerm', message: 'Short-term career goal (next 6 months):',
      validate: (v: string): ValidateResult => v.trim().length > 0 ? true : 'Please enter a short-term goal' },
    { type: 'input', name: 'longTerm', message: 'Long-term career goal (1–3 years):',
      validate: (v: string): ValidateResult => v.trim().length > 0 ? true : 'Please enter a long-term goal' },
    { type: 'input', name: 'targetRole', message: 'Target role:',
      validate: (v: string): ValidateResult => v.trim().length > 0 ? true : 'Please enter a target role' },
  ]);
  return answers;
}

// In promptLeadershipContext() — add after 'managerEmail':
{
  type: 'input',
  name: 'expectations',
  message: 'Key expectations from your manager:',
  validate: (v: string): ValidateResult =>
    v.trim().length > 0 ? true : 'Please enter expectations',
},
```

### Testing

- Framework: Jest 29, ESM mode (identical to Stories 1.2–1.6)
- All mocks via `jest.unstable_mockModule` before dynamic import
- Restore `setupHappyPath()` mock sequence: workspace → provider → apiKey → fullProfile → careerGoals → leadershipContext → teamMembersLoop
- Integration test: restore `experienceYears: 7`, `managementStyle: 'Servant'`, `strengths: 'Empathy, Coaching'`, `shortTerm`, `longTerm`, `targetRole`, `expectations` mock values
- Regression: all existing tests (1.1–1.6 scope) must remain green

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-03 | 0.1 | Story created to track fields deferred from Story 1.6 by product decision | Bob (SM) |
