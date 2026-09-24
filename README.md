# Salary Management for ACME HR

[![CI](https://github.com/vin2k20/salary-management/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vin2k20/salary-management/actions/workflows/ci.yml)

A web application where global and country HR managers maintain pay data for 10,000 employees in India, the USA, Canada and Australia, and see how the organisation pays people on a dashboard.

Status: walking skeleton running locally, features not started. This README is an outline and is filled in as each step of the [implementation plan](docs/implementation-plan.md) is merged.

## Overview

- Two roles: global HR managers see all countries; country HR managers see only their own country.
- Employee directory with search, filters, sorting and paging.
- Employee records with country-specific fields, a change log, and inactive status instead of deletion.
- Pay as a set of components with frequencies, shown as monthly equivalent and annual total, with a dated history of pay changes.
- Daily USD exchange rates and a toggle between USD and local currency.
- Dashboard: pay range per country, average pay per job title, cost per department, monthly and annual cost, and peer outliers.
- Import and export in Excel and CSV.

Full scope: [requirements](docs/requirements.md).

## Architecture

![High level architecture](docs/diagrams/architecture.png)

- **Web app** (`apps/web`): a React single page app built with Vite. It calls the API under `/api` on its own origin: through the Vite proxy in development and a Vercel rewrite in production, so the auth cookie stays first-party and no CORS setup is needed.
- **API** (`apps/api`): a stateless Express 5 service. Node.js 24 runs its TypeScript source directly, with no build step. Every request gets an ID, returned in the `X-Request-Id` header and written on every log line. Errors use the problem details format (RFC 9457) and include the request ID.
- **Shared package** (`packages/shared`): Zod schemas and types used by both the API and the web app.
- **Database** (from step 05): PostgreSQL on Neon.

Full details are in the [high level design](docs/high-level-design.md).

## Tech stack

- TypeScript in strict mode, in one repository with npm workspaces:
  - `apps/api`: Express 5 API with Helmet, pino logging and Zod
  - `apps/web`: React app built with Vite, with TanStack Query for server data
  - `packages/shared`: Zod schemas, types and rules shared by the API and the web app
- Node.js 24, ESLint and Prettier, Vitest with Supertest and React Testing Library.

Choices and reasons are in the [decisions log](docs/decisions-and-questions.md).

## Getting started

Prerequisites: Node.js 24 (see `.nvmrc`; with nvm, run `nvm use`) and npm 11.

```bash
npm install
npm run check
npm run dev
```

`npm run dev` starts the API on http://localhost:3000 and the web app on http://localhost:5173. Open the web app: the home page shows whether the API is available. Stop both with Ctrl+C.

`npm run check` runs lint, the format check, the type check and all tests. Other root scripts:

| Script | What it does |
|---|---|
| `npm run lint` | ESLint with type-aware rules |
| `npm run format` | Format files with Prettier |
| `npm run format:check` | Check formatting without changing files |
| `npm run typecheck` | Type check every workspace |
| `npm test` | Run the tests in every workspace |
| `npm run build` | Build the web app for production (the API runs from source) |
| `npm run dev` | Start the API and the web app in watch mode |

### Environment variables

The API reads its settings from environment variables and stops at start-up if a value is invalid. For local development, copy `apps/api/.env.example` to `apps/api/.env` and change values as needed. `.env` files are never committed.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `LOG_LEVEL` | `info` | pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |

If the API runs on another port, start the web app with `API_PROXY_TARGET` set, for example `API_PROXY_TARGET=http://localhost:4000`.

## Database and seed data

To be completed in steps 05 and 06.

## Tests

Each workspace uses Vitest, with test files next to the code they test (`*.test.ts`). Run all tests with `npm test`, or one workspace with `npm test -w @salary/api`. Test types are added as the build goes on: API tests with Supertest and PGlite, UI tests with React Testing Library, and a Playwright smoke test.

GitHub Actions runs lint, the format check, the type check, all tests and the build on every push and on every pull request to `main` (`.github/workflows/ci.yml`).

## Deployment

To be completed in step 04.

## Demo

To be completed in steps 21 and 22.

- Production URL
- Demo logins for both roles
- Demo video

## Documents

| Document | What it covers |
|---|---|
| [Requirements](docs/requirements.md) | One-page scope, quality bar and what was left out |
| [Clarification questions](docs/clarification-questions.md) | Questions for ACME and the decided answers |
| [Decisions and questions](docs/decisions-and-questions.md) | Technology and design decisions with reasons and alternatives |
| [High level design](docs/high-level-design.md) | Architecture, data model, API, flows, security, testing and deployment |
| [Design approach and trade-offs](docs/design-approach-and-trade-offs.md) | The reasoning behind the design and the options considered |
| [Implementation plan](docs/implementation-plan.md) | Step by step build plan and progress tracker |
| [Research: payroll in India](docs/research-india-payroll.md) | How salary and payroll are managed in India |
| [Research: pay structures by country](docs/research-country-pay-structures.md) | Employee fields and pay components for the four countries |
| [Project history](docs/ai/log.md) | One line per completed step |

## Working with AI

This project is built with Claude Code as a pair programmer. The rules it follows are in [CLAUDE.md](CLAUDE.md).
