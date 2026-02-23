# tech-manager-os

> AI-powered CLI for engineering managers — process meeting notes, manage your team, and track your career growth.

## Overview

`tech-manager-os` is a local-first CLI tool that helps engineering managers stay organized without switching context. It processes meeting transcripts, maintains team context automatically, and surfaces insights when you need them.

## Quick Start

```bash
npm install -g @marlonvidal/tech-manager-os
tm init
```

## Usage

```bash
tm --help       # Show all commands
tm --version    # Show version
tm init         # Interactive onboarding wizard
tm process      # Process inbox files
tm watch        # Auto-process inbox on file changes
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` via tsup |
| `npm run dev` | Run CLI directly via ts-node |
| `npm test` | Run Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check on `src/` |
| `npm run format` | Prettier format `src/` |
| `npm run typecheck` | TypeScript type check (no emit) |

## Requirements

- Node.js 18+
- npm

## Architecture

- **CLI layer:** TypeScript + Commander.js
- **Agent system:** BMAD Builder (Markdown-based agents and skills)
- **AI adapters:** OpenAI, Anthropic, Gemini
- **Storage:** Local file system (no database)

## License

MIT
