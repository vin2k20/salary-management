# Salary Management for ACME HR

[![CI](https://github.com/vin2k20/salary-management/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vin2k20/salary-management/actions/workflows/ci.yml)

A web application where global and country HR managers maintain pay data for 10,000 employees in India, the USA, Canada and Australia, and see how the organisation pays people on a dashboard.

Status: tooling set up, features not started. This README is an outline and is filled in as each step of the [implementation plan](docs/implementation-plan.md) is merged.

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

To be completed in step 03. Summary and diagram from the [high level design](docs/high-level-design.md).

## Tech stack

- TypeScript in strict mode, in one repository with npm workspaces:
  - `apps/api`: Express API (from step 03)
  - `apps/web`: React app built with Vite (from step 03)
  - `packages/shared`: Zod schemas, types and rules shared by the API and the web app
- Node.js 24, ESLint and Prettier, Vitest.

Choices and reasons are in the [decisions log](docs/decisions-and-questions.md).

## Getting started

Prerequisites: Node.js 24 (see `.nvmrc`; with nvm, run `nvm use`) and npm 11.

```bash
npm install
npm run check
```

`npm run check` runs lint, the format check, the type check and all tests. Other root scripts:

| Script | What it does |
|---|---|
| `npm run lint` | ESLint with type-aware rules |
| `npm run format` | Format files with Prettier |
| `npm run format:check` | Check formatting without changing files |
| `npm run typecheck` | Type check every workspace |
| `npm test` | Run the tests in every workspace |
| `npm run build` | Build every workspace that has a build script |
| `npm run dev` | Start every workspace that has a dev script |

Environment variables and running the API and the web app locally are added in step 03.

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
