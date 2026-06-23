# UAT Bug Report

**Tester:** Marlon (Filipe)
**Started:** 2026-05-18
**Vault under test:** `/Users/2566dtidigital/tech-manager-os/tmp/tmr-test-vault`
**tmr version:** 1.0.0

> Bugs só são adicionados aqui após confirmação explícita durante a sessão de teste.

---

## Bugs Confirmados

### BUG-001 — Domain check not implemented (FR41)

| Campo | Detalhe |
|---|---|
| **ID** | BUG-001 |
| **FR** | FR41 |
| **Fase UAT** | Phase 4 — Member Commands (M-04) |
| **Comando** | `tmr member add external@partner.com` |
| **Comportamento esperado** | Domínio `partner.com` não consta em `config/organization.yaml` → sistema deveria perguntar se é contractor ou company member antes de criar o perfil |
| **Comportamento real** | Cria o perfil diretamente em `my-company/members/` sem checar o domínio nem perguntar nada |
| **Severidade** | Média — funcionalidade planejada ausente; não causa crash |
| **Referência no spec** | epics.md FR41: "checks the email domain against config/organization.yaml; external domains prompt for contractor vs. company routing" |

---

### BUG-002 — Jest não consegue parsear arquivos .md importados (9 test suites falham)

| Campo | Detalhe |
|---|---|
| **ID** | BUG-002 |
| **FR** | Infra de testes (Phase 0 — `npm test`) |
| **Fase UAT** | Phase 0 — Pre-flight |
| **Comando** | `npm test` |
| **Comportamento esperado** | Todos os test suites carregam e executam normalmente |
| **Comportamento real** | 9 test suites falham com `SyntaxError: Invalid left-hand side expression in prefix operation` ao tentar parsear `examples/inbox-samples/2026-04-10-Marlon-Alex.md` como JavaScript. Os 837 testes que chegam a rodar passam — é um problema de infra, não de lógica |
| **Causa raiz** | `src/templates/onboarding.templates.ts` importa arquivos `.md` diretamente (`import INBOX_SAMPLE_1 from '../../examples/inbox-samples/...'`). O `tsup`/esbuild resolve isso em build via `loader: { '.md': 'text' }`, mas o Jest não tem esse loader configurado. O arquivo `jest-md-transformer.cjs` já existe no repo com a solução, mas **não foi adicionado ao `transform` do `jest.config.ts`** |
| **Fix necessário** | Adicionar `'\\.md$': '<rootDir>/jest-md-transformer.cjs'` no bloco `transform` do `jest.config.ts` |
| **Severidade** | Alta — impede 9 suites de executar; cobertura de testes reportada está incompleta |
| **Test suites afetadas** | `tests/cli.test.ts`, `tests/integration/member.integration.test.ts`, `tests/services/inbox-process.service.integration.test.ts`, `tests/integration/team.integration.test.ts`, `tests/services/init.service.test.ts`, `tests/commands/init.command.test.ts`, `tests/services/team.service.test.ts`, `tests/integration/init.integration.test.ts`, `tests/templates/onboarding.templates.test.ts` |

---

### BUG-003 — `tmr project add` não cria `deps.yaml` (FR37 não implementado)

| Campo | Detalhe |
|---|---|
| **ID** | BUG-003 |
| **FR** | FR37 |
| **Fase UAT** | Phase 5 — Project Commands (P-01, verificação pós-criação) |
| **Comando** | `tmr project add "API Gateway Rewrite"` |
| **Comportamento esperado** | Cria `<project-dir>/deps.yaml` stub para que `/tmr-project-impact` possa ser invocado a qualquer momento sem criação manual do arquivo |
| **Comportamento real** | Apenas cria `<slug>.md`, `standups/` e `meetings/`. Nenhum `deps.yaml` é gerado |
| **Causa raiz** | `ProjectService.addProject()` não contém nenhuma linha criando `deps.yaml`. FR37 simplesmente não foi implementado no serviço |
| **Severidade** | Média — `/tmr-project-impact` não pode ser invocado sem criação manual do arquivo; funcionalidade dependente bloqueada |
| **Referência no spec** | epics.md FR37: "System creates a stub `deps.yaml` file inside the new project directory when `tmr project add` is run" |

---

### BUG-004 — `tmr-project-impact` não está publicado no registry (tmr update falha para essa skill)

| Campo | Detalhe |
|---|---|
| **ID** | BUG-004 |
| **FR** | FR25 / FR27 — SkillRegistryService abstraction |
| **Fase UAT** | Fase 2 Phase G — tmr update |
| **Comando** | `tmr update` |
| **Comportamento esperado** | `tmr-project-impact` atualizada do registry assim como `tmr-myself-config` e `tmr-inbox` |
| **Comportamento real** | `✖ tmr-project-impact: could not reach registry — Skill "tmr-project-impact" not found in registry` — a skill está instalada localmente (v0.0.0 bundled no init) mas nunca foi publicada no registry oficial |
| **Impacto** | Usuários ficam presos na versão bundled (v0.0.0) para sempre; não há caminho de atualização via `tmr update` |
| **Severidade** | Média — skill funciona localmente mas não pode ser atualizada |

---

## Pendentes de Confirmação

_Nenhum no momento._

---

## Log de Sessão

| Data | Fase | Observação |
|---|---|---|
| 2026-05-18 | Phase 0–2 | Passed — vault criado corretamente, estrutura de arquivos validada |
| 2026-05-18 | Phase 4 M-04 | BUG-001 identificado e confirmado |
| 2026-05-18 | Phase 0 `npm test` | BUG-002 identificado e confirmado — 9 suites falham por falta de transformer .md no Jest |
| 2026-05-18 | Phase 5 P-01 | BUG-003 identificado e confirmado — deps.yaml não é criado pelo `tmr project add` |
| 2026-05-18 | Phase 6–8 (Fase 1) | Passed — error handling, tmr doctor, tmr install all OK |
| 2026-05-18 | Fase 2 Phase A | Passed — tmr config set-key, show-security, switch-provider, error guard all OK |
| 2026-05-18 | Fase 2 Phase B | Passed — tmr today, this-week, this-month, this-quarter, --json, --plain all OK |
| 2026-05-18 | Fase 2 Phase D | Passed — tmr leadership add, list, 1on1 all OK |
| 2026-05-18 | Fase 2 Phase E | Passed — tmr member add assessment, performance-review all OK |
| 2026-05-18 | Fase 2 Phase F | Partial — tmr watch starts and monitors inbox/ correctly; auto-process on file drop BLOCKED (requires AI API key) |
| 2026-05-18 | Fase 2 Phase G | Partial — tmr-myself-config updated OK, tmr-inbox up to date OK, tmr-project-impact NOT in registry → BUG-004 |
| 2026-05-18 | Fase 2 Phase I | Passed — Obsidian graph correct; all expected connections present; duplicate node was Obsidian layout artifact, not a bug (confirmed single filipe@gmail.com.md file) |
| 2026-05-18 | Fase 2 Phase C, H | BLOCKED — requires AI API key; will be tested by manager |
