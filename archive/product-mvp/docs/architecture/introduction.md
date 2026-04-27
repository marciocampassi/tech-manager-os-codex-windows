# Introduction

This document outlines the overall project architecture for **Tech Leadership OS**, including backend systems, shared services, and non-UI specific concerns. Its primary goal is to serve as the guiding architectural blueprint for AI-driven development, ensuring consistency and adherence to chosen patterns and technologies.

**Relationship to Frontend Architecture:**
If the project includes a significant user interface, a separate Frontend Architecture Document will detail the frontend-specific design and MUST be used in conjunction with this document. Core technology stack choices documented herein (see "Tech Stack") are definitive for the entire project, including any frontend components.

## Starter Template or Existing Project

**Decision: Greenfield Development**

This project is being built from scratch with the following approach:

- **No existing codebase or starter template** - Fresh TypeScript CLI project
- **CLI Framework:** Commander.js (industry standard, used by npm, create-react-app, Vue CLI)
- **BMAD Builder Integration:** Will implement BMAD Builder framework (https://github.com/bmad-code-org/bmad-builder) as a core dependency for agent and skill system extensibility
- **Rationale:** Starting fresh allows us to architect specifically for local-first file operations, AI agent orchestration, and Obsidian integration without inherited constraints

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2026-02-20 | 1.0 | Initial architecture document created | Winston (Architect) |

---
