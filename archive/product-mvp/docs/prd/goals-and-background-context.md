# Goals and Background Context

## Goals

- Create a **local-first workspace system** that serves as an "Operating System" for Tech Leadership Roles (Engineering Managers, Data Managers, Group Product Managers, etc.)
- Solve **"Management Entropy"** (lost context, scattered notes, recency bias) by treating management artifacts as organized, AI-enhanced context
- Implement **"Skills-as-Intelligence"** where Claude Code skills provide management assistance through installable, version-controlled skill files — not hardcoded CLI commands
- Enable **"Transcript-to-Context"** workflow where meeting transcripts are automatically categorized and filed into the appropriate contexts
- Provide **zero-latency insight** through CLI + IDE integration with structured local file system
- Support **"Agnostic Intelligence (BYOK)"** where users bring their own API Keys (OpenAI, Claude, or Gemini)
- Deliver an MVP focused on **vault scaffolding, inbox processing, and a distributable skills foundation** that leaders can extend over time
- Build an **extensible system** with SKILL.md-based extensibility allowing community-driven management approaches
- Enable **leaders to manage themselves** with equal attention to their own career development
- Align with **Tech Manager de Resultados (TMR)** community branding and values
- Use **Obsidian** as the primary vault interface, with the workspace folder serving as the Obsidian vault root
- Integrate **Granola** as the official meeting transcript capture tool, synced to `inbox/` via the Granola Sync Obsidian plugin
- Build the agent/skill system on **BMAD Builder** framework for standardized, extensible, community-compatible agent and skill definitions

## Background Context

Tech leaders in management roles face chronic problems across multiple dimensions:

1. **Team Context Loss:** Critical information about team members gets scattered across notes, Slack, emails. When it's time for 1:1s or reviews, leaders scramble to remember what happened weeks ago.

2. **Project Status Amnesia:** Weekly status meetings require reconstructing what happened from fragmented notes, leading to inaccurate reporting and missed risks.

3. **Leader's Own Career Neglect:** While tracking team development religiously, leaders often neglect their own PDPs, brag documents, and career conversations with their own managers.

4. **Transcript Overload:** Meeting recordings generate transcripts that sit unused because there's no system to extract value and file them appropriately.

5. **Operational Context Sprawl:** Hiring pipelines, leadership meeting notes, company announcements, and incident post-mortems all live in different tools with no unified context.

6. **Multi-Team Complexity:** Leaders managing multiple teams struggle to maintain context across different groups and their unique dynamics.

Tech Leadership OS solves this by:
- **Inbox-First Capture:** Drop any transcript or note into `inbox/`, run `tmr process`, and AI categorizes everything
- **Context Maintenance:** AI maintains running summaries for each person, project, and operational area
- **Skills-Driven Intelligence:** Distributable Claude Code skills (starting with `tmr-inbox`) provide domain expertise and are extended over time via `tmr install` / `tmr update`
- **Local-First Privacy:** All data stays local, no vendor lock-in, full ownership
- **IDE-Native Workflow:** Agents work naturally in Cursor, Claude Code, Gemini CLI, and GitHub Copilot
- **Multi-Team Support:** Manage multiple teams with separate contexts and relationships
- **SKILL.md Extensibility:** Community-driven extensibility through standardized skill definitions

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2026-04-14 | 4.4 | Skills-based architecture pivot: Epics 4–7 removed, new Epic 4 introduced, `tmr init` pivoted to vault scaffolding + CLAUDE.md generation, `tmr-inbox` promoted to first distributable Claude Code skill, `tmr install`/`tmr update` mechanism added | John (PM) + Marlon (PO) |
| 2026-02-19 | 4.3 | Obsidian Terminal plugin added as official in-vault CLI tool; Obsidian promoted to primary daily workspace; setup guide expanded and renamed to `obsidian-setup.md`; FR41, tech stack, folder structure, and UX vision updated | Marlon (PO) |
| 2026-02-19 | 4.2 | Brainstorm-to-spec: routing decision table, confidence-gated routing, single-pass AI manifest, append-only context strategy, archive-after-process flow, standard file header format, folder philosophy principle, optional process log flag — captured in FR4, FR42, Story 6.2 | Mary (Analyst) + Marlon (PO) |
| 2026-02-19 | 4.1 | Course correction: BMAD Builder as core agent engine, Granola+Obsidian as official transcript stack, email-as-identity formalized, dedicated meeting processing skill added (FR41, FR42), FR38-FR40 replaced | John (PM) + Marlon (PO) |
| 2026-02-10 | 4.0 | Strategic refinement: Tech Leadership OS rebrand, tmr-* agents, multi-team support, enhanced extensibility | John (PM) + Marlon (Product Owner) |
| 2026-02-08 | 3.0 | Complete architecture redesign: Agent-based system, expanded to manager's career + operations | Mary (Analyst) + John (PM) |
| 2026-01-29 | 2.0 | Initial PRD draft for "Methodology-as-Code" edition | John (PM) |

---
