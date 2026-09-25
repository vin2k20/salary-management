# Salary Management for ACME HR: Implementation Plan

Author: Vineet Kumar | Date: 24 Sep 2026 | Version: 0.3 (living document; update the progress tracker as work moves on)

## 1. Purpose

This plan breaks the build into small steps. Each step delivers one part of the application end to end, is tested automatically and by hand, and is committed before the next step starts. The commit history then shows how the solution grew, which the assessment asks for.

Each step is written so it can be handed to a separate Claude session or agent with enough context to plan and build it without reading the whole conversation history.

Related documents: `requirements.md`, `clarification-questions.md`, `decisions-and-questions.md`, `high-level-design.md`, `design-approach-and-trade-offs.md`, `research-country-pay-structures.md`.

## 2. How we work on every step

### 2.1 Step workflow

1. Create a short-lived branch named `step/NN-short-name` from `main`.
2. If the step has both API and UI work, commit the shared Zod schemas first. This fixes the contract, so API and UI work can then run in parallel.
3. Build in small test-first cycles: commit the failing test, then the code that makes it pass, then any clean-up.
4. Run lint, type check and all tests locally.
5. Do the manual check listed for the step and note the result in the pull request.
6. Update documentation touched by the step (README, design notes, decisions) and add a one-line summary to the project history.
7. Open a pull request titled `Step NN: <name>`, let CI pass, and merge with a **merge commit** (not squash), so every small commit stays visible and each step appears as one group in `git log --graph`.
8. Update the progress tracker in section 6.

### 2.2 Commit message convention

Conventional Commits, with the workspace as the scope:

```
test(api): <behaviour being specified>      failing test first
feat(api): <behaviour added>                code that makes it pass
refactor(web): <what was tidied>            no behaviour change
perf(db): <what got faster>                 measured improvement
fix(shared): <what was wrong>
docs: <what was documented>
chore: <tooling or config>
ci: <pipeline change>
```

Scopes: `api`, `web`, `shared`, `db`, `e2e`, or none for repository-wide changes. The planned commits in each step are a guide. Split or merge them as the work needs, but keep them small and meaningful.

Every commit message has three parts:

- **Subject line** in the format above.
- **Body:** one short sentence on what the commit does, then bullet points listing what changed in the software (features, rules, tests, configuration, documents).
- **Trailer:** `Co-Authored-By: Claude <noreply@anthropic.com>`, which shows the AI pairing in the history.

The body describes the software only. It never describes prompts or how the AI was used. Example:

```
feat(api): add employee list endpoint

Adds the paged employee list with search, filters and sorting.

- GET /api/employees with page, pageSize, sort and filters
- Country HR users only see their own country
- Inactive employees hidden unless includeInactive is set
- Annual total and monthly equivalent in USD or local currency

Co-Authored-By: Claude <noreply@anthropic.com>
```

Every commit and push is confirmed with Vineet first.

### 2.3 Definition of done for every step

- Automated tests for the new behaviour, written first where practical, all passing locally and in CI.
- Access rules tested for both roles wherever the step adds or changes an endpoint.
- Lint and type check pass.
- Manual check done and noted in the pull request.
- No secrets, real personal data or pay amounts in logs or commits.
- Documentation updated, and a one-line summary added to the project history (`docs/ai/log.md`).
- Merged to `main`. From step 04 onwards, the deployed version still works.

### 2.4 Handing a step to a new Claude session

Give the new session this context:

- Read `CLAUDE.md`, this plan (the step's section and section 5), and the design sections listed under "Read first" in the step.
- Work only on this step. Do not start the next one.
- Follow the workflow in 2.1 and the definition of done in 2.3.
- Follow the answers in section 5 and the decisions document. If something is still unclear, choose the simplest option that fits them, note it in the pull request and record it in the decisions document.

## 3. Step overview and dependencies

| Step | Name | Phase | Depends on | Can run in parallel with |
|---|---|---|---|---|
| 00 | Repository and documentation baseline | Foundation | None | None |
| 01 | Monorepo and tooling | Foundation | 00 | None |
| 02 | Continuous integration | Foundation | 01 | 03 |
| 03 | Walking skeleton (API and UI) | Foundation | 01 | 02 |
| 04 | First deployment | Foundation | 02, 03 | 05 |
| 05 | Database schema and reference data | Data | 03 | 04 |
| 06 | Seed 10,000 employees | Data | 05 | 07 |
| 07 | Login, roles and country scope | Access | 05 | 06 |
| 08 | Password reset and invite emails | Access | 07 | 10, 14 |
| 09 | User management | Access | 08 | 10 to 14 |
| 10 | Exchange rates and currency toggle | Features | 07 | 08, 09, 14 |
| 11 | Employee directory | Features | 06, 07, 10 | 09, 14 |
| 12 | Employee record | Features | 11 | 14, 15 |
| 13 | Pay items and pay history | Features | 12 | 14, 15 |
| 14 | Pay component catalogue | Features | 07 | 09 to 13 |
| 15 | Dashboard | Features | 06, 10, 11 | 12, 13, 14, 16 |
| 16 | Export to Excel and CSV | Features | 13 | 15 |
| 17 | Import from Excel and CSV | Features | 13, 16 | None |
| 18 | Security, accessibility and quality pass | Hardening | 09 to 17 | 19 |
| 19 | End-to-end smoke test | Hardening | 13, 15 | 18 |
| 20 | Performance check | Hardening | 11, 15 | 18, 19 |
| 21 | Production release | Delivery | 18 to 20 | None |
| 22 | Demo video and submission | Delivery | 21 | None |

```
Foundation:  00 > 01 > 02 and 03 > 04
Data:        03 > 05 > 06
Access:      05 > 07 > 08 > 09
Features:    07 > 10
             06, 07 and 10 > 11 > 12 > 13
             07 > 14
             06, 10 and 11 > 15
             13 > 16 > 17
Hardening:   09 to 17 > 18, 19, 20
Delivery:    18, 19 and 20 > 21 > 22
```

Steps 09, 14 and 15 are the best candidates for parallel sessions once their dependencies are merged.

## 4. Steps

### Step 00: Repository and documentation baseline

**Goal:** Start the Git history with the thinking done so far, before any code.

**Scope:** Git repository, `.gitignore` (node_modules, build output, `.env` files, `.DS_Store`, and `*.docx` as a safety net), `.nvmrc` (Node.js 24), `.editorconfig`, README outline, `CLAUDE.md` with project rules for AI pair programming, the project history (`docs/ai/log.md`, already started), and the existing documents. Word copies of the documents are kept outside the repository, in `../salary-management-word-docs`, and are never committed.

**Tests:** None (no code yet).

**Manual check:** Repository opens on GitHub, documents and diagrams display correctly.

**Planned commits:**

```
chore: add repository basics (gitignore, nvmrc, editorconfig)
docs: add research notes on salary and payroll in India
docs: add research on employee fields and pay components by country
docs: add clarification questions with the decided answers
docs: add one-page requirements
docs: add decisions log
docs: add high level design with diagrams
docs: add design approach and trade-offs
docs: add implementation plan
docs: add project history
chore: add CLAUDE.md with project rules for AI pair programming
docs: add README outline
```

### Step 01: Monorepo and tooling

**Goal:** One command runs lint, type check and tests for every workspace.

**Read first:** HLD 3.5 (repository layout), decisions D1, D7, D12.

**Scope:** npm workspaces (`apps/api`, `apps/web`, `packages/shared`), shared strict TypeScript config, ESLint (flat config) and Prettier, Vitest in each workspace, root scripts (`dev`, `lint`, `typecheck`, `test`, `build`).

**Tests:** One trivial test per workspace to prove the setup.

**Manual check:** `npm run lint`, `npm run typecheck` and `npm test` all pass from the root.

**Planned commits:**

```
chore: set up npm workspaces for api, web and shared
chore: add shared TypeScript configuration
chore: add ESLint and Prettier
test: add Vitest with a sample test in each workspace
chore: add root scripts for lint, typecheck, test and build
```

### Step 02: Continuous integration

**Goal:** Every push and pull request is checked automatically.

**Scope:** GitHub Actions workflow: install, lint, type check, test, build. Cache npm dependencies.

**Tests:** The workflow itself.

**Manual check:** Push a branch, see the workflow pass. Push a deliberately failing test on a throwaway branch, see it fail, then delete the branch.

**Planned commits:**

```
ci: add workflow for lint, typecheck, test and build
docs: add CI badge to README
```

### Step 03: Walking skeleton (API and UI)

**Goal:** The React app calls the API and shows its health. Proves the full path before features.

**Read first:** HLD 2, 3.2 (middleware), 5 (conventions), 11.

**Scope:**
- API: `createApp()` factory, `GET /api/health`, Helmet, pino logging with request IDs, 404 handler, error handler returning problem details.
- Web: Vite React app, app shell layout, home page showing API status, Vite proxy for `/api`.
- Shared: health response schema.

**Tests:** Supertest for health, 404 and error format. React Testing Library for the status display.

**Manual check:** Run API and web locally, open the browser, see the status. Check a request ID in the logs.

**Planned commits:**

```
feat(shared): add health response schema
test(api): health endpoint returns ok
feat(api): add Express app factory with health endpoint
test(api): unknown routes return problem details
feat(api): add not-found and error handlers with problem details
feat(api): add security headers and request logging
feat(web): scaffold React app with Vite
test(web): home page shows API status
feat(web): show API health on home page
chore(web): proxy /api to the local API in development
```

### Step 04: First deployment

**Goal:** The skeleton runs in production, so every later step deploys to a working setup.

**Read first:** HLD 10, decisions D13, D19, section 8 of this plan.

**Scope:** Vercel project for the web app with the `/api/*` rewrite to Render. Render web service for the API with a health check. Environment variables. Neon project created (used from step 05), in the same region as the Render service. Accounts are created by me, not by an agent. All services are used on their free plans.

**Tests:** CI stays green.

**Manual check:** The production URL loads and shows API health through the same-origin rewrite. The API is not called cross-origin from the browser (check in DevTools).

**Planned commits:**

```
chore(web): add Vercel configuration with /api rewrite
chore(api): add Render service configuration
docs: add deployment notes to README
```

### Step 05: Database schema and reference data

**Goal:** The data model from the HLD exists, with migrations, reference data and a fast test database.

**Read first:** HLD 4 (data model), decisions D3, D4, D8, D25, D26, D30, D34, `research-country-pay-structures.md`.

**Scope:**
- Shared: money helpers (minor units, formatting with currency minor digits) and frequency helpers (annual amount, monthly equivalent).
- API: Drizzle setup and connection; tables for `currencies`, `countries`, `pay_frequencies`, `pay_components`, `employees`, `pay_changes`, `pay_items`, `fx_rates` and `change_log`; a change log helper that services call inside their transaction; the `current_pay_totals` view; indexes including the trigram index; reference data for the four countries, their currencies, the eight frequencies and the system pay components per country; a PGlite helper that gives each test file a fresh migrated database; database status in the health check.

**Tests:** Money and frequency helpers (all eight frequencies). Migrations apply cleanly. The totals view returns the right annual total, gross pay and monthly equivalent, ignores ended and future-dated items, and leaves out employer contributions from gross pay.

**Manual check:** Run migrations against a local database or a Neon development branch and inspect the tables and reference data.

**Planned commits:**

```
test(shared): money conversion and formatting cases
feat(shared): add money helpers using currency minor digits
test(shared): annual and monthly amounts for every pay frequency
feat(shared): add pay frequency helpers
chore(api): add Drizzle and database connection
feat(db): add currencies, countries and pay frequencies with reference data
feat(db): add pay components with system components per country
feat(db): add employees table with country-specific fields
feat(db): add pay changes and pay items tables
feat(db): add exchange rates table
feat(db): add change log table
test(api): change log helper records old and new values in the same transaction
feat(api): add change log helper
feat(db): add current pay totals view and indexes
test(api): add PGlite test database helper
test(db): current pay totals ignore ended and future-dated items
feat(api): include database status in health check
```

### Step 06: Seed 10,000 employees

**Goal:** A repeatable script loads the same realistic data set on every run.

**Read first:** Decisions D11, D33, `research-country-pay-structures.md`.

**Scope:** Data generator using Faker with a fixed seed. 6,000 India, 1,500 USA, 1,500 Canada, 1,000 Australia. About 80% full-time, 8% part-time, 8% contractors, 4% interns. Regions, departments, job titles and levels per country. Pay components and approximate rates per country and employment type. One to three pay changes per employee. Some inactive employees. Starting exchange rates. Batched inserts and a reset option. HR users are added in step 07.

**Tests:** Same output for the same seed. Country split and employment type mix within small tolerances. Every employee has current pay. Seeding a small count into PGlite works.

**Manual check:** Seed a local database, count rows per table and per country, time the run, spot-check a few employees per country.

**Planned commits:**

```
test(api): seed generator is deterministic for a fixed seed
test(api): seed data matches the country split and employment type mix
feat(api): add employee generator per country
feat(api): add pay generator per country and employment type
feat(api): add seed script with batched inserts and starting exchange rates
docs: document seeding in README
```

### Step 07: Login, roles and country scope

**Goal:** Only signed-in HR users can reach data, and country HR users only see their own country.

**Read first:** HLD 3.3 (access rules), 6.1, 7, decisions D17, D19, D23.

**Scope:**
- API: `users` table with role and country; Argon2id hashing; JWT in an httpOnly cookie using `jose`; token version check; `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; auth middleware that builds the scope on all routes except health, auth and the internal rates endpoint; a scope helper that repositories must use; rate limit on login; seeded users (one global HR, one HR user per country) with passwords from environment variables.
- Web: login page, loading the current user on start, protected routes, navigation that shows only what the role allows, logout.

**Tests:** Hashing and token helpers. Login success, wrong password, inactive user, rate limit. Protected routes reject missing or outdated tokens. The scope helper filters by country for country HR and not for global HR. Login form validation.

**Manual check:** Sign in as the global user and as a country user and compare what each sees. In DevTools, confirm the cookie is httpOnly and SameSite=Lax, and Secure in production.

**Planned commits:**

```
feat(shared): add login, user and role schemas
test(api): passwords are hashed and verified with Argon2id
feat(api): add password hashing service
feat(db): add users table with role and country
test(api): login sets a session cookie for valid credentials
feat(api): add login, logout and current user endpoints
test(api): protected routes reject missing or outdated tokens
feat(api): add auth middleware with token version check
test(api): country HR scope limits queries to one country
feat(api): add scope helper for repositories
feat(api): add rate limit on login
feat(api): seed global and country HR users from environment variables
test(web): login form shows validation and auth errors
feat(web): add login page, protected routes and role-aware navigation
feat(web): add logout to the app shell
```

### Step 08: Password reset and invite emails

**Goal:** Users can reset a forgotten password, and new users can set their first password, through single-use emailed links.

**Read first:** HLD 6.1, 7, decision D18.

**Scope:**
- API: `auth_tokens` table with purpose (reset or invite); `POST /api/auth/forgot-password` (always 202); `POST /api/auth/set-password` for both purposes; an email sender interface with a Brevo sender for production and a console sender for development and tests; rate limit.
- Web: forgot password page and set password page (used by reset and invite links).

**Tests:** Token creation, hashing, expiry (30 minutes for reset, 72 hours for invite) and single use. Same response for known and unknown emails. Older sessions stop working after a reset. Pages validate input.

**Manual check:** Receive a real email through Brevo in development, set a new password, and confirm the link fails on second use and after expiry.

**Planned commits:**

```
feat(shared): add password reset and set password schemas
test(api): auth tokens are hashed, single use and expire by purpose
feat(db): add auth tokens table
feat(api): add email sender interface with console sender
feat(api): add Brevo email sender
test(api): forgot password responds the same for any email
feat(api): add forgot password endpoint
test(api): setting a password invalidates older sessions
feat(api): add set password endpoint for reset and invite links
feat(web): add forgot password and set password pages
```

### Step 09: User management

**Goal:** Global HR users can add HR users, set their role and country, resend invites and deactivate users.

**Read first:** HLD 3.1, 3.3, 5, decision D24.

**Scope:**
- API: `GET /api/users`, `POST /api/users` (sends an invite), `PATCH /api/users/:id` (role, country, active), `POST /api/users/:id/invite`, `GET /api/users/:id/change-log`. Deactivation raises the token version so the user is signed out. Every change is written to the change log.
- Web: users page with a table, add user form and actions.

**Tests:** Only global HR can use these endpoints. A country HR user must have a country. A deactivated user cannot sign in and existing sessions stop working. Invite email is sent through the sender interface.

**Manual check:** Add a country HR user, accept the invite from the email, sign in as them, then deactivate them and confirm they are signed out.

**Planned commits:**

```
feat(shared): add user management schemas
test(api): only global HR users can manage users
test(api): new users receive an invite and deactivated users are signed out
feat(api): add user management endpoints
test(web): users page validates role and country
feat(web): add users page with add, invite and deactivate actions
```

### Step 10: Exchange rates and currency toggle

**Goal:** USD rates are refreshed every day, and every screen can show amounts in USD or local currency.

**Read first:** HLD 6.4, decisions D28, D29, section 8 of this plan.

**Scope:**
- API: a Frankfurter client (passed in, so tests use a fake), `GET /api/fx-rates/latest`, `POST /api/fx-rates/refresh` (global HR), `POST /api/internal/fx-rates/refresh` (shared secret, constant-time check), upsert per currency and date, and a shared conversion helper that uses the latest rate on or before a date.
- GitHub Actions: a scheduled workflow that calls the internal endpoint once a day, with a manual run option.
- Web: currency toggle in the header, kept in the URL and browser storage; rate date shown next to converted amounts; notice when rates are more than three days old; manual refresh button for global HR.

**Tests:** Conversion helper. Refresh stores rates from a fake response and ignores repeats for the same date. The internal endpoint rejects a wrong or missing secret. Only global HR can refresh by hand. The toggle changes displayed amounts.

**Manual check:** Run the workflow by hand from GitHub, confirm new rates are stored with the right date, and switch the toggle in the UI.

**Planned commits:**

```
feat(shared): add exchange rate schemas and conversion helper
test(shared): amounts convert to USD with the latest rate on or before a date
test(api): refresh stores rates per currency and date from the rate provider
feat(api): add Frankfurter client and rates refresh service
test(api): internal refresh endpoint requires the shared secret
feat(api): add exchange rate endpoints
ci: add daily workflow to refresh exchange rates
feat(web): add currency toggle and rate date display
feat(web): add manual rates refresh for global HR
```

### Step 11: Employee directory

**Goal:** HR users can search, filter, sort and page through the employees in their scope quickly.

**Read first:** HLD 3.1, 5, 6.2, 8.

**Scope:**
- Shared: list query schema (search, country, region, department, job title, employment type, include inactive, sort, page, page size, currency) and list response schema.
- API: `GET /api/employees` with annual total and monthly equivalent from the totals view, in USD or local currency; `GET /api/reference` with filter options within scope.
- Web: directory page with TanStack Table, server-side paging and sorting, filters kept in the URL, include inactive option, loading, empty and error states.

**Tests:** Query parsing and defaults. Filtering, partial name search, sorting by annual total, paging and totals. Inactive employees hidden unless included. Country HR users only get their country, even if they ask for another. UI keeps filters in the URL.

**Manual check:** With the seeded data, try each filter and sort as both roles, bookmark a filtered view and reload it, and check response times in DevTools (target under 500 ms).

**Planned commits:**

```
feat(shared): add employee list query and response schemas
test(api): list employees filters, sorts and pages results
test(api): list employees stays within the user's country scope
feat(api): add employee list endpoint
test(api): inactive employees are hidden unless included
feat(api): add reference data endpoint for filters
test(web): directory keeps filters in the URL
feat(web): add employee directory page
feat(web): add filters, sorting, paging and include inactive option
```

### Step 12: Employee record

**Goal:** HR users can open, add and edit employees in their scope, and mark leavers as inactive.

**Read first:** HLD 3.1, 4, 5, decisions D30, D31, `research-country-pay-structures.md`.

**Scope:**
- Shared: create and update employee schemas, with a country-specific fields schema per country.
- API: `GET /api/employees/:id`, `POST /api/employees`, `PATCH /api/employees/:id` (details, mark inactive), `GET /api/employees/:id/change-log`, duplicate employee code returns 409, trimmed and consistently cased job title and department, out-of-scope records return 404, every change written to the change log.
- Web: employee detail page, create and edit forms with country-specific fields, inactive action with confirmation, change log section.

**Tests:** Validation per country, creation, duplicate code, update, marking inactive, out-of-scope access for country HR. Form behaviour per country.

**Manual check:** Create an employee in each country, edit one, mark one inactive, and confirm a country HR user cannot open another country's employee.

**Planned commits:**

```
feat(shared): add employee schemas with country-specific fields
test(api): employees are validated with their country's fields
feat(api): add get and create employee endpoints
test(api): duplicate employee codes are rejected
test(api): country HR users cannot read or change other countries
test(api): employees can be updated and marked inactive
feat(api): add update employee endpoint
feat(web): add employee detail page
feat(web): add create and edit employee forms with country fields
feat(web): add mark inactive action
test(api): employee changes appear in the change log with old and new values
feat(api): add employee change log endpoint
feat(web): show the change log on the employee page
```

### Step 13: Pay items and pay history

**Goal:** HR users can see each employee's pay components with monthly and annual totals, record pay changes and see the history.

**Read first:** HLD 4, 6.2 (pay change rules), decisions D25, D26, D27, D35, D36.

**Scope:**
- Shared: pay change schema (effective date, reason, components to set or end).
- API: `GET /api/employees/:id/pay`, `GET /api/employees/:id/pay-changes`, `POST /api/employees/:id/pay-changes` (one transaction: end changed items, add new ones), `POST /api/employees/:id/transfer` (global HR only: change country, end all pay, start new pay in the new currency). New employees get their starting pay through a pay change with the reason "hire". Pay changes and moves are written to the change log.
- Web: pay section on the employee page (components, frequency, amount, monthly equivalent, annual total, in USD or local currency), history list, and a "record pay change" dialog.

**Tests:** Pay change rules: several components at once, ending a component, future-dated changes not affecting current pay, currency must match the employee's country. History order. Totals after a change. Dialog behaviour.

**Manual check:** Give an employee a raise on two components, add a new allowance, end another, and check totals, history, the change log, the directory and the currency toggle. Record a future-dated change and confirm current pay does not change yet. As global HR, move an employee to another country and confirm the old country's HR user can no longer see them.

**Planned commits:**

```
feat(shared): add pay change schemas
test(api): a pay change ends changed items and starts new ones
test(api): future-dated pay changes do not affect current pay
feat(api): add pay change service
feat(api): add current pay and pay history endpoints
feat(api): add record pay change endpoint
feat(web): show pay components and totals on the employee page
feat(web): add pay history and record pay change dialog
feat(web): set starting pay when creating an employee
test(api): moving an employee restarts pay in the new country's currency
test(api): only global HR users can move employees between countries
feat(api): add move to another country endpoint
feat(web): add move to another country action for global HR
```

### Step 14: Pay component catalogue

**Goal:** HR users can add new pay components with a category and default frequency, and deactivate ones no longer used.

**Read first:** HLD 3.3, 4, 5, decision D25.

**Scope:**
- API: `GET /api/pay-components` (with frequencies; added read-only in step 13, D52), `POST /api/pay-components`, `PATCH /api/pay-components/:id` (rename, deactivate). Global HR for any country or all countries; country HR for their own country. Deactivated components stay on existing pay items but cannot be used for new ones. Changes are written to the change log.
- Web: pay components page, add form and deactivate action.

**Tests:** Validation, unique code per country, scope rules for both roles, deactivated components rejected in new pay changes.

**Manual check:** Add a component for one country, use it in a pay change, deactivate it, and confirm it no longer appears for new changes.

**Planned commits:**

```
feat(shared): add pay component schemas
test(api): pay components follow the user's country scope
feat(api): add pay component endpoints
test(api): deactivated components cannot be used in new pay changes
feat(web): add pay components page
```

### Step 15: Dashboard

**Goal:** HR users see how the organisation pays people in one place: pay range per country, average pay per job title, cost per department, monthly and annual cost, and peer outliers.

**Read first:** HLD 3.1 (currency toggle), 5, 6.2, 8, decisions D27, D28, D32, D36.

**Scope:**
- API: `GET /api/insights/summary`, `/pay-range-by-country`, `/by-job-title?country=`, `/cost-by-department?country=`, `/outliers?country=`, with `measure` (total or gross), `currency` and `includeInactive`, all within scope and computed in SQL. Org-wide totals in USD.
- Web: dashboard with summary cards, charts and tables, country selector, measure switch and rate date. On a country view the toggle switches between USD and that country's currency; on the all-countries view, org-wide totals stay in USD and per-country figures follow the toggle. Monthly cost is shown next to annual cost.

**Tests:** Statistics against a small data set with known answers, including medians and quartiles. Peer outliers with the 20% limit and the minimum group size. Currency conversion in results. Scope for both roles. Dashboard renders each section.

**Manual check:** Compare a few figures with hand-written SQL on the seeded data, in both currencies and as both roles.

**Planned commits:**

```
feat(shared): add insights query and response schemas
test(api): pay range per country matches known values
feat(api): add summary and pay range endpoints
test(api): job title and department statistics match known values
feat(api): add job title and department cost endpoints
test(shared): peer comparison flags pay outside 20% of the peer median
test(api): outliers endpoint uses peer groups of at least five
feat(api): add outliers endpoint
test(web): dashboard shows each section for the selected country
feat(web): add dashboard with charts, tables and measure switch
```

### Step 16: Export to Excel and CSV

**Goal:** HR users can download employees and pay components in the format that import accepts.

**Read first:** HLD 6.3, 7 (spreadsheet export), decision D21.

**Scope:**
- Shared: column definitions for both datasets (one definition used by export, import and templates).
- API: `GET /api/exports?format=xlsx|csv&dataset=employees|pay` with the directory filters and the user's scope, streamed in batches, with formula escaping. An Excel file contains both sheets.
- Web: export menu on the directory.

**Tests:** Formula escaping. Exported files read back with the expected columns and rows. Country HR exports only contain their country.

**Manual check:** Open exported files in Excel or LibreOffice and check columns, currencies and special characters.

**Planned commits:**

```
feat(shared): add spreadsheet column definitions for employees and pay
test(api): export escapes cells that start with formula characters
test(api): exported files contain the filtered rows within scope
feat(api): add export endpoint for xlsx and csv
feat(web): add export menu to the directory
```

### Step 17: Import from Excel and CSV

**Goal:** HR users can upload a file, see every problem by row, and save it only when it is fully valid.

**Read first:** HLD 6.3, decision D20.

**Scope:**
- API: `GET /api/imports/template`, `POST /api/imports/validate` (size and type limits, parse, validate each row with the shared schemas and the user's scope, preview of rows to add and update), `POST /api/imports/commit` (validate again, one transaction, match employees by code and components by code, pay changes with reason "import").
- Web: import page with upload, preview, error table by row and column, confirm, and result summary.

**Tests:** Row validation for both datasets. Parsing CSV and .xlsx fixtures. A file with one bad row saves nothing. Rows for another country are errors for country HR users. Exporting then importing the same file changes nothing.

**Manual check:** Export, edit a few rows in a spreadsheet, import, and check the changes. Import a file with errors and read the error table.

**Planned commits:**

```
test(api): import rows are validated with the shared schemas and scope
feat(api): add import templates
feat(api): add import validate endpoint with row-level errors
test(api): import commit saves nothing when any row is invalid
test(api): exporting then importing the same file changes nothing
feat(api): add import commit endpoint
feat(web): add import page with preview and row errors
feat(web): add import confirmation and result summary
```

### Step 18: Security, accessibility and quality pass

**Goal:** Close gaps before release.

**Read first:** HLD 3.3, 7, 11.

**Scope:** A test that walks every endpoint as a country HR user and checks out-of-scope access; content security policy and security headers on Vercel; review of rate limits and body and upload limits; production cookie flags; dependency audit; log review for personal data; keyboard and screen reader checks on key screens; consistent error and empty states.

**Tests:** Tests for any gap found. Automated accessibility checks on key pages.

**Manual check:** Walk through a security and accessibility checklist and record the result in the pull request.

**Planned commits:**

```
test(api): every endpoint enforces country scope for country HR users
feat(web): add content security policy and security headers
fix: <each issue found, as its own commit>
test(web): key pages pass automated accessibility checks
docs: add security and accessibility checklist results
```

### Step 19: End-to-end smoke test

**Goal:** One browser test proves the main path works: sign in, search, record a pay change, see the dashboard update, switch currency.

**Read first:** HLD 9.

**Scope:** Playwright setup, one smoke test, CI job that runs it against the API and web app with a PostgreSQL service container and a small seed.

**Tests:** The smoke test itself.

**Manual check:** Run it locally and in CI, and view the trace for a run.

**Planned commits:**

```
chore(e2e): add Playwright setup
test(e2e): sign in, search, change pay and view the dashboard in both currencies
ci: run end-to-end smoke test with a PostgreSQL service
```

### Step 20: Performance check

**Goal:** Confirm list and dashboard responses meet the 500 ms target with the seeded data.

**Read first:** HLD 8, `design-approach-and-trade-offs.md` 4.9.

**Scope:** Timing of the main endpoints, `EXPLAIN ANALYZE` for list, totals and dashboard queries, index or query changes if needed (stored totals only if the view is too slow), results written to `docs/performance.md`.

**Tests:** Existing tests stay green after any change.

**Manual check:** Compare timings before and after changes on the production-like setup.

**Planned commits:**

```
docs: record baseline timings for list and dashboard endpoints
perf(db): <index or query change, if needed>
docs: record timings after changes
```

### Step 21: Production release

**Goal:** A complete, working deployment ready for review.

**Scope:** Production environment variables and secrets (including the rates secret in GitHub and Render), migrations and seed on the production database, a manual run of the rates workflow, smoke test against the production URL, final README (overview, architecture, setup, tests, deployment, demo logins for both roles, links to all documents), project history completed.

**Manual check:** Full walk-through on the production URL in a fresh browser profile, as a global and a country HR user. Note in the README that the first request after a quiet period can take about a minute while the free API service wakes up.

**Planned commits:**

```
docs: complete README with setup, architecture, demo logins and links
docs: complete project history
chore: <release configuration changes, if any>
```

### Step 22: Demo video and submission

**Goal:** Record the demo and hand in the repository.

**Scope:** A short video walking through the problem, the answers to the clarification questions, the design, the main features for both roles and the tests. Link it from the README. Final review of the commit history and documents. Open the application a few minutes before recording, and again before sending the submission, so the free API service is awake. The reply email to Incubyte is sent by me.

**Planned commits:**

```
docs: add demo video link
```

## 5. Clarification questions and answers

The clarification questions were shared with the Incubyte team. The team replied that everything in the assessment brief is important and should be considered at each step, and left the detailed decisions to me. I then answered each question myself, acting as the product owner, and later confirmed the details and follow-up decisions A to D below. This plan follows them. Full answers are in `clarification-questions.md`.

| # | Question | Status | Answer | Steps |
|---|---|---|---|---|
| Q1 | Users and roles | Answered | Global HR managers see all data; country HR managers see only their country. Global HR manages users with email invites. | 07, 09, all scoped steps |
| Q2 | Login | Answered | JWT login with forgot and reset password by email through Brevo | 07, 08 |
| Q3 | Salary definition | Answered | Pay is several components with frequencies (weekly to yearly); monthly and annual views; HR can add components | 05, 13, 14, 15 |
| Q4 | Fields | Answered | Researched per country for USA, Canada, Australia and India | 05, 06, 12 |
| Q5 | Currency | Answered | Local currencies; org-wide in USD; rates refreshed daily; USD toggle | 05, 10, 11, 13, 15 |
| Q6 | Pay history | Answered | Keep the history of pay changes | 05, 13 |
| Q7 | Employee types | Answered | Full-time, part-time, contractors and interns; India 60%, USA 15%, Canada 15%, Australia 10% | 05, 06, 11, 15 |
| Q8 | Leavers | Answered | Inactive, hidden unless included | 11, 12, 15 |
| Q9 | Pay questions | Answered | All of them, on a dashboard; peers flagged at more than 20% from the peer median | 15 |
| Q10 | Payroll | Answered | Not needed; data and insights, built to grow | None |
| Q11 | Import and export | Answered | Wanted, in Excel (two sheets) and CSV | 16, 17 |
| A | History of employee detail changes | Decided | Change log for employees, pay, pay components and users | 05, 09, 12, 13, 14 |
| B | Moving employees between countries | Decided | Global HR only; ends current pay and starts new pay in the new currency | 13 |
| C | Monthly expenses | Decided | Monthly cost from current pay; actual payments not recorded | 15 |
| D | Currency on country views | Decided | Toggle between USD and the country's currency; org-wide totals in USD | 10, 11, 13, 15 |

## 6. Progress tracker

| Step | Status | Branch or pull request | Merged on | Notes |
|---|---|---|---|---|
| 00 | Done | Committed directly on `main` (D37) | 24 Sep 2026 | No pull request for this step |
| 01 | Done | [#1](https://github.com/vin2k20/salary-management/pull/1) | 24 Sep 2026 | TypeScript 6.0 until typescript-eslint supports 7 (D38) |
| 02 | Done | [#2](https://github.com/vin2k20/salary-management/pull/2) | 24 Sep 2026 | Workflow runs on every push and on pull requests to main |
| 03 | Done | [#3](https://github.com/vin2k20/salary-management/pull/3) | 24 Sep 2026 | Node.js runs the TypeScript source directly (D39) |
| 04 | Done | [#4](https://github.com/vin2k20/salary-management/pull/4), [#5](https://github.com/vin2k20/salary-management/pull/5), [#6](https://github.com/vin2k20/salary-management/pull/6) | 24 Sep 2026 | API and database in Ohio (D40); web app at acme-salary-management-vineet.vercel.app |
| 05 | Done | [#7](https://github.com/vin2k20/salary-management/pull/7) | 24 Sep 2026 | Migrations run in the Render build (D41); totals function and rounding (D42) |
| 06 | Done | [#8](https://github.com/vin2k20/salary-management/pull/8) | 24 Sep 2026 | Seed details (D43); reset and reload in about 45 seconds |
| 07 | Done | [#9](https://github.com/vin2k20/salary-management/pull/9) | 24 Sep 2026 | Sign-in details (D44), web foundations (D45); rate limit sees the client IP in production |
| 08 | Done | [#10](https://github.com/vin2k20/salary-management/pull/10) | 24 Sep 2026 | Reset and invite details (D46); real email through Brevo checked |
| 09 | Done | [#11](https://github.com/vin2k20/salary-management/pull/11) | 24 Sep 2026 | User management rules (D48); main branch ruleset (D47) |
| 10 | Done | [#12](https://github.com/vin2k20/salary-management/pull/12) | 24 Sep 2026 | Exchange rate details (D49); daily workflow run by hand |
| 11 | Done | [#13](https://github.com/vin2k20/salary-management/pull/13) | 24 Sep 2026 | Directory details (D50); every dropdown uses a styled Radix Select |
| 12 | Done | [#14](https://github.com/vin2k20/salary-management/pull/14) | 24 Sep 2026 | Employee record details (D51); job title suggestions and scoped spelling checks |
| 13 | Done | [#15](https://github.com/vin2k20/salary-management/pull/15) | 24 Sep 2026 | Pay change details (D52); read-only component list, totals on the employee endpoint, US dollars converted in the browser |
| 14 | Done | [#16](https://github.com/vin2k20/salary-management/pull/16) | 25 Sep 2026 | Pay component rules (D53); codes unique among the components each country can use |
| 15 | Not started | | | |
| 16 | Not started | | | |
| 17 | Not started | | | |
| 18 | Not started | | | |
| 19 | Not started | | | |
| 20 | Not started | | | |
| 21 | Not started | | | |
| 22 | Not started | | | |

## 7. Change log

| Date | Change |
|---|---|
| 24 Sep 2026 | First version of the plan, with all clarification questions open |
| 24 Sep 2026 | Step 00 updated: Word copies kept outside the repository, gitignore added first, project history already started. Added section 8 on hosting costs. |
| 24 Sep 2026 | Commit message format added to section 2.2: subject, short summary, bullet points about the software, co-author trailer; every commit confirmed first. |
| 24 Sep 2026 | Version 0.3: details confirmed; added the change log, moving employees between countries, monthly cost from current pay and the currency toggle on country views to steps 05, 09, 12, 13, 14 and 15. |
| 24 Sep 2026 | Version 0.2: clarification questions answered. Added steps for user management, exchange rates, pay items and pay history, and the pay component catalogue; the dashboard replaces pay insights; 23 steps in total. |

## 8. Hosting costs

Every service runs on its free plan. Limits were checked on 24 Sep 2026 and can change, so check them again when creating the accounts.

| Service | Free plan | Limits that matter here | Effect on this project |
|---|---|---|---|
| GitHub | Free | Public repositories get free GitHub Actions minutes. Scheduled workflows can start a few minutes late and are paused after 60 days without repository activity. | The daily rates job fits easily. Re-enable it if the repository is idle for two months. |
| Vercel (Hobby) | Free, for personal and non-commercial use | 100 GB data transfer and 1 million edge requests a month; usage pauses if limits are exceeded | A personal assessment project fits the Hobby terms. Traffic is far below the limits. |
| Render | Free web service | 512 MB memory, 0.1 CPU, 750 instance hours a month, sleeps after 15 minutes without traffic and takes about a minute to wake. Cron jobs are not free. | The first request after a quiet period is slow. Wake the API before demos and reviews. The daily rates job runs in GitHub Actions instead of Render. Render's free PostgreSQL expires after 30 days, which is why Neon is used instead. |
| Neon | Free | 0.5 GB storage and 100 compute hours per project a month, pauses after 5 minutes idle | 10,000 employees and around 100,000 pay rows need only tens of MB. The first query after a pause is slightly slower. |
| Brevo | Free | 300 emails a day, shared between marketing and transactional email, sender address must be verified | Reset and invite emails are a handful a day. |
| Frankfurter | Free, no account or key | Rate limited to prevent abuse; rates published on working days | One call a day plus occasional manual refreshes. |

If a sign-up asks for payment details, stop and check before adding any, since none of these plans needs a paid upgrade for this project.
