# Salary Management for ACME HR

[![CI](https://github.com/vin2k20/salary-management/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vin2k20/salary-management/actions/workflows/ci.yml)

A web application where global and country HR managers maintain pay data for 10,000 employees in India, the USA, Canada and Australia, and see how the organisation pays people on a dashboard.

Status: walking skeleton deployed, features not started.

Live app: https://acme-salary-management-vineet.vercel.app (the first request after a quiet period can take about a minute while the free API service wakes up). This README is an outline and is filled in as each step of the [implementation plan](docs/implementation-plan.md) is merged.

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
- **Database** (from step 05): PostgreSQL on Neon, in the same AWS region as the API.

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
cp apps/api/.env.example apps/api/.env   # then set DATABASE_URL
npm run db:migrate -w @salary/api
npm run db:seed -w @salary/api
npm run check
npm run dev
```

`npm run dev` starts the API on http://localhost:3000 and the web app on http://localhost:5173. Open the web app: the home page shows whether the API and the database are available. Stop both with Ctrl+C.

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
| `DATABASE_URL` | none, required | PostgreSQL connection string. Locally, the pooled string of your Neon development branch (or a local PostgreSQL database), ending in `sslmode=verify-full` for Neon |
| `PORT` | `3000` | Port the API listens on |
| `LOG_LEVEL` | `info` | pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |

If the API runs on another port, start the web app with `API_PROXY_TARGET` set, for example `API_PROXY_TARGET=http://localhost:4000`.

## Database and seed data

PostgreSQL, accessed with Drizzle ORM. The schema is defined in `apps/api/src/db/schema.ts`, and every change is a versioned SQL migration in `apps/api/drizzle/`.

| Script | What it does |
|---|---|
| `npm run db:migrate -w @salary/api` | Apply pending migrations to the database in `DATABASE_URL`. Safe to run again. |
| `npm run db:generate -w @salary/api` | Write a new migration after changing the schema. Review the SQL before committing it. |

The migrations also load the reference data: the four countries and their currencies, the eight pay frequencies and the system pay components per country. Pay totals come from the `current_pay_totals` view, built on the `pay_totals_on(date)` function, which adds up the pay items that apply on a date as annual amounts in local currency.

### Seed data

`npm run db:seed -w @salary/api` loads a synthetic data set for the dashboard, filters and peer comparison. It is generated with Faker from a fixed seed and a fixed reference date, so every run loads exactly the same data:

- 10,000 employees: 6,000 in India, 1,500 in the USA, 1,500 in Canada and 1,000 in Australia, with names in each country's style, regions, ten departments and six levels.
- About 80% full-time, 8% part-time, 8% contractors and 4% interns, and about 5% inactive.
- Pay components and approximate 2026 rates per country from the research notes, with employer contributions as amounts; contractors get a contract fee and interns a stipend. A few employees are paid well above or below their peers.
- One to three pay changes per employee: the hire, then up to two yearly revisions or promotions (April in India, January elsewhere). About 18,000 pay changes and 114,000 pay items.
- Starting exchange rates to US dollars, marked with the source `seed`.

Emails use the reserved `example.com` domain, and no real personal data or pay is used.

| Option | What it does |
|---|---|
| `-- --reset` | Replace existing employees, pay and seed exchange rates. Reference data is kept. Without it, the script stops if employees exist. |
| `-- --count 2000` | Load fewer employees, keeping the same country split. |
| `-- --seed 42` | Generate a different data set. |

The load runs in one transaction, so a failed run changes nothing. Against the Neon development branch it takes about 45 seconds.

## Tests

Each workspace uses Vitest, with test files next to the code they test (`*.test.ts`). Run all tests with `npm test`, or one workspace with `npm test -w @salary/api`. API and database tests run against PGlite, PostgreSQL in memory: each test file gets a fresh database with every migration applied, so tests need no running database or network. UI tests use React Testing Library, and a Playwright smoke test comes later.

GitHub Actions runs lint, the format check, the type check, all tests and the build on every push and on every pull request to `main` (`.github/workflows/ci.yml`).

## Deployment

Every service runs on its free plan.

| Part | Service | Address | Configuration |
|---|---|---|---|
| Web app | Vercel (Hobby) | https://acme-salary-management-vineet.vercel.app | `vercel.json` |
| API | Render free web service, Ohio | https://acme-salary-api-oxu3.onrender.com | `render.yaml` |
| Database (from step 05) | Neon free plan, AWS us-east-2 (Ohio) | Connection string in Render settings only | |

How it fits together:

- The browser only talks to the Vercel domain. Vercel serves the web app and rewrites `/api/*` to the Render API, so the auth cookie stays first-party and no CORS setup is needed.
- A merge to `main` deploys both parts. Vercel builds the web app. Render deploys the API only after the CI workflow has passed on the commit, and only when API, shared or root package files change.
- Each pull request gets a Vercel preview deployment. Previews need a Vercel login and call the production API.
- The Render build runs `npm ci --omit=dev` and then applies database migrations, so they run before the new version starts. A failed migration fails the deploy and the running version stays up.
- The Render service runs `node apps/api/src/server.ts`, with a health check on `/api/health`, which also checks the database. Render sets `PORT`; `NODE_ENV` and `LOG_LEVEL` come from `render.yaml`. `DATABASE_URL` (the pooled string of the Neon production branch) and later secrets are set in the Render dashboard and never committed.
- The free Render service sleeps after 15 minutes without traffic and takes about a minute to wake. Open the app a few minutes before a demo.

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
