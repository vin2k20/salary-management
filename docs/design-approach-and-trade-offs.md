# Salary Management for ACME HR: Design Approach, Choices and Trade-offs

Author: Vineet Kumar | Date: 24 Sep 2026 | Version: 0.2 (companion to the requirements, decisions and high level design documents; updated with the answered clarification questions)

## 1. Summary

The application is a **modular monolith**: one React single page app and one Node.js API, backed by one PostgreSQL database. Inside the API, code is grouped **by feature** (auth, users, employees, compensation, pay components, insights, exchange rates, import and export, reference data), and each feature is **layered** into routes, services and repositories. The UI and the API share one set of validation schemas, so the contract between them is written once.

The guiding rule for every choice is: **pick the simplest design that meets the requirements for 10,000 employees, keeps salary data correct and private, and is easy to test and change.** Scale features such as microservices, a separate cache or background job queues are left out on purpose, with a clear path to add them if the numbers ever call for it.

## 2. Design structure

| Level | Structure used | What it means here |
|---|---|---|
| System | Client and server, three tiers | Presentation (React app), application (Node.js API) and data (PostgreSQL) are separate tiers that talk over HTTP and SQL. |
| Deployment | Modular monolith | One API service holds all features. Modules have clear boundaries, so one could be split out later without a rewrite. |
| API code | Package by feature, layered inside each feature | Each module has routes (HTTP), services (business rules) and repositories (SQL). Dependencies point one way: routes to services to repositories. |
| Business rules | Functional core, thin shell | Rules such as picking the current salary, statistics helpers and import row checks are plain functions with no I/O, which makes them fast to test. The layers around them do the I/O. |
| Contract | Schema-first, shared | Zod schemas in `packages/shared` define every request and response. The UI, the API and the import feature all use them. |
| API style | REST, stateless | Resource URLs, standard HTTP methods and status codes, problem details for errors. Any API instance can serve any request. |
| Data | Normalised relational model with effective-dated pay items | Pay is a set of components per employee. A pay change closes the old items and adds new ones instead of overwriting them, so history is never lost. |
| Front end | Component based, server state separated from UI state | TanStack Query owns data from the server. Local component state and the URL own everything else. No global store is needed. |
| Access | Role and country scope applied on the server | Every repository call takes the signed-in user's scope, so a country HR user can only read or change their own country's data. |
| Operations | Twelve-factor style | Configuration in environment variables, stateless processes, logs as a stream, the same code in every environment. |
| Delivery | Test-driven, small commits, continuous integration | Tests first where practical, every push checked in CI, main always deployable. |

## 3. How the design was produced, start to end

1. **Read the brief and the email.** The email asks candidates to ask rather than assume, so open points became questions instead of guesses.
2. **Research the domain.** Reviewed how salary and payroll work in India and what widely used products (greytHR, Keka, Zoho Payroll, RazorpayX Payroll, Darwinbox) offer.
3. **Frame the scope.** Concluded the brief asks for salary data management and pay insights, not payroll processing.
4. **Write the one-page requirements** with goal, features, quality bar and what is deliberately left out.
5. **Write the clarification questions** (11 questions, two of them as proposals for login and import/export) with the planned tech stack.
6. **Record the decisions** with reasons and alternatives.
7. **Write the high level design** with architecture, data model, API, flows, security, performance, testing and deployment.
8. **Share the questions and act on the response.** The Incubyte team replied that everything in the brief is important and left the details to me. I answered the questions myself, researched employee fields and pay components for the four countries, and updated the requirements, decisions, design and plan.
9. **Next:** a walking skeleton (one feature end to end, deployed), then features built test first, then the demo video.

Each step has a document in the `docs` folder, so the reasoning is visible in the repository history.

## 4. Choices, alternatives and trade-offs

Each table lists what was chosen, what else was considered, why the choice was made, and what is given up.

### 4.1 Architecture style

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Modular monolith: one API service and one single page app | Microservices; serverless functions per endpoint; one Next.js app for both UI and API | One deployable API is simpler to build, test, debug and run. Module boundaries keep the code organised. The brief asks for a clear backend and UI. | Cannot scale or deploy features separately. A bug in one module can affect the whole API. Acceptable for one team and 10,000 employees. |
| Separate UI and API deployments | One container serving both | Each part is hosted where it fits best: static files on a CDN, the API on a Node host. | Two deployments to manage, and a rewrite rule to keep the API on the same origin. |

### 4.2 Language and runtime

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| TypeScript everywhere | JavaScript | Types catch mistakes early and document the code. Types are shared between UI and API. Matches the role. | A build step and some typing effort. |
| Node.js 24 LTS | Node.js 22 LTS; Bun; Deno | Current long-term support release with built-in watch mode and environment file support. | Bun and Deno start faster, but have less hosting and library support. |

### 4.3 Backend framework and contract

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Express 5 | Fastify; NestJS; Hono; Koa | Widely known, small, and Express 5 passes errors from async handlers to the error middleware. Easy for reviewers to read. | Fewer built-in features than Fastify (schema validation, speed) or NestJS (dependency injection, structure). We add structure through folders and conventions instead. |
| Zod schemas shared by UI and API | OpenAPI first with code generation; tRPC; GraphQL; class-validator | One source of truth for validation, written in TypeScript, reused by forms and the import feature. | No generated API documentation by default. It can be added later by generating OpenAPI from the Zod schemas. |
| REST API | GraphQL; tRPC | Simple, cacheable, easy to test with plain HTTP, and fits the resource-shaped data. | The UI sometimes needs more than one call per screen. GraphQL would avoid that but adds a schema layer and more tooling. tRPC would tie the API to TypeScript clients. |

### 4.4 Database and data access

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| PostgreSQL | SQLite; MySQL; MongoDB | Relational data with reporting needs. Built-in `percentile_cont` for the median, trigram search, strong transactions. Listed in the role. Free managed hosting on Neon. | Needs a running server, unlike SQLite. SQLite would be simpler to set up but has no built-in median and is less like a production setup. |
| Drizzle ORM with versioned migrations | Prisma; Kysely; Knex; plain `pg` driver; TypeORM | Typed queries that read like SQL, so statistics queries stay clear. Light at runtime. | Smaller community than Prisma. Prisma has a nicer schema language but needs raw SQL for medians and has a heavier runtime. |

### 4.5 Data model

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Pay components catalogue, dated pay items, and pay changes that group them | One salary column; components as JSON on the employee; one row per employee per month | Matches pay made of several components, lets HR add components, keeps full history and supports future-dated changes. | More tables and joins than a single salary column, and every total must be calculated from the items. |
| `current_pay_totals` view (annual total, gross pay and monthly equivalent per employee) | Store the totals on the employee row on every change | No duplicated data that can drift out of sync. Fast enough at this size with the right indexes. | Slightly slower reads than stored totals. Stored totals are the fallback if measurements require it. |
| Frequencies as a table with periods per year | A fixed list in code | A new frequency needs no code change, and every conversion follows one rule. | Slightly more setup than a hard-coded list. The meaning of "bi-" (every two) is a documented decision that HR must know. |
| Employer contributions stored as amounts | Calculating them from rates per country | No yearly rule changes to maintain, which keeps the tool about data and insight. | Amounts must be updated by HR when rates change. |
| One `change_log` table written by services in the same transaction as each change | A history table per entity; database triggers | One place to read who changed what, for every kind of record, with no database-specific code. | Old and new values are stored as JSON, which is harder to query, and every service must remember to write the log. Mitigated by one helper used by all services and tests that check the log. |
| Moving an employee to another country ends current pay and starts new pay in the new currency; global HR only | Not allowing moves; letting country HR users move employees | Pay stays in the right local currency, and moves between country scopes stay with users who can see both countries. | A move needs new pay amounts entered at the same time. |
| Money as whole minor units (`bigint`) plus currency code | `numeric` decimal columns; floating point numbers | Exact arithmetic with no rounding errors, and simple integer sums. | Every display needs formatting with the currency's minor digits, stored in the `currencies` table. |
| UUID primary keys, plus a unique employee code | Auto-increment integers | IDs do not reveal record counts and can be created by any process. The employee code stays the business key used in Excel. | UUIDs are larger and less readable than integers. |
| Mark leavers as inactive, hidden unless included (Q8) | Hard delete | History and reports stay complete. Mistakes can be undone. | Every query must filter by status, and data is kept longer, which matters for privacy rules. |
| Job title and department stored as text | Lookup tables for job titles and departments | Matches how the data looks in Excel today and keeps import simple. | Spelling differences split groups in insights. Mitigation: trim and normalise case on write, and offer suggestions in forms. Lookup tables are the next step if the data is messy. |
| Local currency per employee, converted to USD when reading (Q5) | Convert everything to USD when saving | Keeps the amounts HR entered and lets the same data show in both currencies. | Every USD figure depends on the stored rate, so screens must show the rate date. |
| Common employee columns plus country-specific fields in a JSON column validated per country (Q4) | A table per country; many nullable columns | Shared queries stay simple while countries can differ. | JSON fields are harder to filter and index, so only fields that are never filtered go there. |

### 4.6 Front end

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| React single page app with Vite | Next.js; React Router in framework mode; Angular | An internal tool behind a login does not need server rendering or search engine visibility. Vite gives a fast development loop. Clear split from the API. | No server rendering, so the first load shows a loading state until data arrives. Acceptable for a logged-in tool. |
| TanStack Query for server data | Redux Toolkit with RTK Query; SWR; Zustand plus fetch | Caching, refetching and clearing data after changes with little code. No global store is needed for this app. | One more library to learn. Redux would suit an app with a lot of shared client-side state, which this is not. |
| URL holds directory filters and paging | Component state only | Filtered views can be bookmarked, shared and survive a page refresh. | Filters must be parsed and validated from the URL. |
| TanStack Table | AG Grid; MUI Data Grid | Headless and light, works well with server-side paging and sorting. | We build the table markup ourselves. AG Grid gives more features out of the box but is heavier and some features are paid. |
| shadcn/ui on Radix | MUI; Ant Design; Mantine; Chakra UI | Accessible components whose code lives in the repository, so they are easy to adjust. | We own and maintain the copied component code. MUI would give more ready-made components with less control over styling. |
| React Hook Form with Zod | Formik; TanStack Form | Few re-renders and direct reuse of the shared schemas. | Another library; plain controlled forms would be enough for very simple forms. |
| Recharts | Chart.js; Apache ECharts; Nivo | Simple React components for the bar and distribution charts needed here. | Less suited to very large data sets or complex charts. ECharts would be the choice for heavy dashboards. |

### 4.7 Authentication, access and email

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Signed JWT in an httpOnly, Secure, SameSite cookie | Server sessions with a session table; JWT in localStorage; managed auth (Auth0, Clerk, Supabase Auth); Passport | The token cannot be read by page scripts, which limits damage from a cross-site scripting bug. No session store is needed. | A JWT cannot be cancelled on its own before it expires. We add a token version check against the user row, which gives instant logout on password reset but means one small database read per request, so the design is not fully stateless. Server sessions would be an equally valid choice. |
| Argon2id for password hashing | bcrypt; scrypt | Current first recommendation for password storage, resistant to GPU attacks. | Uses a native module, which adds a build step on deploy. bcrypt is simpler to install. |
| Password reset and invites by email through Brevo, sharing one token mechanism (Q1, Q2) | Admin-set passwords; Resend; SendGrid; Amazon SES; Postmark | A standard, secure flow reused for both cases. Brevo has a free tier and a simple transactional API. | An external dependency, a sender address to verify, and an API key to protect. |
| Two roles with country scope enforced in services and repositories (Q1) | PostgreSQL row-level security; hiding data only in the UI; a permissions library | One clear place to apply the rule, easy to test for every endpoint, and no database-specific setup. | Relies on every repository function taking the scope. Mitigated by making scope a required argument and testing both roles on every endpoint. Row-level security could be added later as a second layer. |
| Out-of-scope records return 404 | Return 403 | Does not reveal that a record exists in another country. | Slightly harder to debug, since "not found" can mean "not allowed". |
| Same-origin API through a Vercel rewrite | Cross-origin calls with CORS and cross-site cookies | The auth cookie stays first-party, which browsers allow, and no CORS setup is needed. | An extra hop through Vercel for each API call, and a dependency on Vercel's rewrite feature. |
| In-memory rate limiting on auth routes | Rate limiting backed by Redis or the database | No extra service. Enough for one API instance. | Limits reset when the API restarts and are not shared across instances. Move to a shared store if the API is scaled out. |

### 4.8 Import and export (Q11)

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| ExcelJS for .xlsx, csv-parse for CSV, on the server | SheetJS; PapaParse; parsing files in the browser | Server-side parsing means the same checks run no matter which client uploads. ExcelJS reads and writes .xlsx and supports streaming. | Files travel to the server twice (validate, then commit). Browser parsing would give faster previews but duplicate the rules. |
| Two calls: validate, then commit the same file | Store the upload and commit by ID | The API stays stateless and needs no file storage. | The file is uploaded and parsed twice. Fine for files of about 10,000 rows. |
| All or nothing: save only when every row is valid | Save valid rows and report the rest | No half-loaded data that is hard to clean up. | One bad row blocks the whole file until it is fixed. |
| Synchronous import | Background job with progress updates | Simple, with no queue or worker to run. | Very large files could hit request time limits. A job queue is the path for much larger files. |
| Match rows to employees by employee code | Match by name or email | Employee code is the stable business key in the current sheets. | Rows without a code cannot update existing employees. |
| Excel file with two sheets (employees, pay components); CSV holds one of them | One wide sheet with a column per component | Works when components differ by country and when HR adds new ones. | Two datasets to explain to users, and CSV needs two files for a full round trip. |

### 4.9 Performance, search and caching

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Paging, filtering, sorting and statistics in SQL | Load all rows into the browser and work there | Sends only what the screen shows. The database does what it is built for. | More API parameters to design and test. |
| Offset paging | Keyset (cursor) paging | Simple, and supports jumping to any page. Fast enough for 10,000 rows. | Gets slower on very deep pages with millions of rows, and rows can shift between pages during edits. |
| Trigram index for name search | PostgreSQL full-text search; a search engine such as Meilisearch or Elasticsearch | Fast partial matching on names with no extra service. | No ranking or typo tolerance beyond what trigrams give. |
| Statistics computed on each request | Materialized views; pre-computed tables; a separate analytics store | Always up to date, with no refresh logic. Queries take milliseconds at this size. | Cost grows with data size. Materialized views refreshed after writes are the next step. |
| No server-side cache. Caching in the browser (TanStack Query), on the CDN (app files) and with HTTP headers for reference data | Redis or an in-memory cache in the API | The whole data set fits in PostgreSQL's memory, so the database already acts as a cache. A server cache would risk showing old pay figures after an edit and adds a service to run. | If traffic or data grows a lot, some repeated queries will cost more than they would with a cache. Order of fixes: measure, then materialized views, then Redis. |
| Peers are the same country, job title and employment type; flag above or below 20% of the peer median; skip groups under five (Q9) | Percentile bands; standard deviation scores | Easy to explain to HR and to test, and the median is not skewed by a few very high salaries. | A fixed limit does not suit every role. The limit is one configuration value, so it can be tuned. |

### 4.10 Exchange rates (Q5)

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Frankfurter API (central bank reference rates) | Paid rate APIs; rates entered by hand | Free, no API key, covers USD, CAD, AUD and INR. | Rates are published on working days only, and the service has no uptime guarantee. Stored rates and a manual refresh cover gaps. |
| Daily GitHub Actions job calling a protected API endpoint | Render cron jobs; Vercel cron; a timer inside the API | Free for public repositories, logs every run, and wakes the sleeping free API service. | Scheduled runs can start a few minutes late, and GitHub pauses schedules in repositories with no activity for 60 days. Vercel cron is a free fallback; Render cron jobs need a paid plan. |
| Rates stored per date | Overwrite one current rate | Earlier figures can be reproduced, and the rate date can be shown. | A few extra rows a day. |

### 4.11 Testing

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Test first where practical, with a test pyramid | Tests after the code; mainly end-to-end tests | Many fast unit tests, fewer API tests, one end-to-end test. Matches the role and the brief. | Writing tests first takes discipline and some time up front. |
| Vitest | Jest | Fast, works with Vite and TypeScript without extra setup, Jest-compatible API. | Slightly smaller ecosystem than Jest. |
| PGlite (PostgreSQL in memory) for API and database tests | Testcontainers with Docker; mocking repositories; SQLite in tests | Real PostgreSQL behaviour, including medians and trigram search, without Docker. Tests stay fast and deterministic. | Not identical to the hosted server in every detail, such as connection pooling and some extensions. The deployed smoke test covers the gap. |
| Supertest for HTTP tests | Calling handlers directly | Tests go through routing, middleware and validation like real requests. | Slightly slower than calling functions directly. |
| React Testing Library | Enzyme; snapshot-only tests | Tests the UI the way a user sees it. | Some internal states are harder to reach. |
| Playwright for one smoke test | Cypress; no end-to-end test | Confirms the real app works end to end in a browser. Matches the role. | Slower and more brittle than unit tests, so kept to one main path. |

### 4.12 Repository, tooling and delivery

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| One repository with npm workspaces | pnpm workspaces; Turborepo; Nx; separate repositories | Shares the schema package with no publishing, and one history shows the whole change. npm needs no extra install. | No build caching across packages. Turborepo or Nx would add that for larger codebases. |
| ESLint and Prettier | Biome | Standard, well documented, many plugins. | Two tools instead of one, and slower than Biome. |
| GitHub Actions: lint, type check, tests and build on every push | Other CI services; local checks only | Built into GitHub, free for public repositories, visible to reviewers. | Tied to GitHub. |
| Vercel for the UI, Render for the API, Neon for PostgreSQL | One container on Render, Railway or Fly.io; AWS (S3, CloudFront, ECS or Lambda, RDS); Supabase | Free tiers, deploys from Git, and each service suits its part. | Three providers to configure. Render's free tier sleeps when idle, so the first request can be slow. Neon pauses when idle too. Keep the API and the database in the same region. |
| Migrations run before each API release | Manual schema changes | Every environment has the same schema, recorded in the repository. | Migrations must be written so the old and new API versions can both run during a release. |
| Structured logs with pino and a health endpoint | OpenTelemetry tracing; Sentry error tracking | Enough to trace a request and let the host check health. | No error alerts or dashboards. Sentry is a quick addition if needed. |

### 4.13 Scope

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Pay data and insights only, no payroll (Q10) | Include payroll: tax, statutory deductions, payslips | Confirmed by the answer to Q10. Payroll rules differ per country and change often. | HR still needs a separate payroll tool. |
| Global and country HR roles (Q1) | One HR role; finer permissions per action | Matches the answer to Q1 with two clear roles. | Other roles, such as finance or line managers, would need new permission rules. |
| Pay as components with frequencies (Q3) | One annual salary figure | Matches the answer to Q3 and allows component-level analysis. | More data to enter and import, and more rules to test. |
| Monthly cost worked out from current pay | Recording actual payments each month | Answers monthly spend without becoming payroll (Q10). | Shows expected cost, not what was actually paid in a month. |
| No government IDs, bank details, date of birth or gender | Store them for completeness | Not needed for pay data or insights, and each adds privacy risk. | No pay gap analysis by gender unless that decision is revisited. |

### 4.14 Working with AI

| Chosen | Alternatives | Why | Trade-off |
|---|---|---|---|
| Claude Code as a pair programmer, with project rules in `CLAUDE.md` and a short project history in `docs/ai/log.md` | AI use without records; no AI tools | The brief asks for intentional, visible AI use. The history shows what was done at each step. | A little time spent on notes. Every AI change still has to be reviewed and covered by tests before it is committed. |

## 5. Principles behind the trade-offs

- **Simple first, with a known next step.** Each simple choice has a named upgrade path: offset paging to keyset paging, view to stored column, on-demand statistics to materialized views, in-memory limits to a shared store, synchronous import to background jobs.
- **Correct before fast.** No server cache, all-or-nothing imports and exact money types, because wrong salary numbers cost more than a few milliseconds.
- **One source of truth.** Shared schemas for validation, one database, the employee code as the business key.
- **Private by default.** Every endpoint needs a login, tokens are not readable by page scripts, and logs never hold salaries or passwords.
- **Managed over self-hosted.** Hosted database, hosting and email, so time goes into the product rather than servers.
- **Ask, then decide.** Open product points were raised as questions first. When the team left the details to me, I decided each answer and recorded it with the reasoning.

## 6. What would change at a larger scale

| If this happens | Change |
|---|---|
| Hundreds of thousands of employees | Keyset paging, materialized views for insights, stored pay totals on the employee row |
| Many users and several API instances | Rate limits and any cache in a shared store such as Redis, more API instances behind the host's load balancer |
| More roles, such as finance or line managers | A roles and permissions table, finer checks in services, and an audit log |
| Large or frequent imports | Background jobs with progress updates, and file storage for uploads |
| Heavy reporting needs | A read replica or a separate analytics store |
| Features owned by different teams | Split a module, such as import and export, into its own service along the existing module boundary |

## 7. Glossary

| Term | Meaning |
|---|---|
| Modular monolith | One deployable application whose code is split into modules with clear boundaries |
| Layered architecture | Code split into layers (routes, services, repositories), where each layer only calls the one below it |
| Effective-dated records | Rows that say from which date a value applies, so history is kept instead of overwritten |
| Minor units | The smallest unit of a currency, such as paise or cents, stored as whole numbers |
| Keyset paging | Paging that continues from the last row seen instead of skipping a number of rows |
| Materialized view | A query result saved as a table and refreshed when needed |
| Trigram index | A PostgreSQL index that speeds up partial text matches, such as part of a name |
| httpOnly cookie | A cookie the browser sends with requests but page scripts cannot read |
| Same origin | UI and API served from the same domain, so the browser treats calls as first-party |
