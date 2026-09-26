# Project History

Author: Vineet Kumar | Started: 23 Sep 2026

A short record of the work on this project, from start to end. The work is done with Claude Code as an AI pair programmer, and every output is reviewed before it is kept. A line is added at the end of each step.

| Date | What was done |
|---|---|
| 23 Sep 2026 | Researched how salary and payroll are managed in India and in widely used HR products, and mapped the findings to the assessment scope. |
| 23 Sep 2026 | Wrote the one-page requirements and a short list of clarification questions for ACME. |
| 23 Sep 2026 | Chose the tech stack and recorded the decisions, with reasons and alternatives. |
| 23 Sep 2026 | Created the high level design: architecture, data model, API, key flows, security, testing and deployment, with diagrams. |
| 23 Sep 2026 | Reviewed caching and decided against a server-side cache at this scale. |
| 23 Sep 2026 | Documented the design structure, the alternatives considered and the trade-offs. |
| 24 Sep 2026 | Wrote the step by step implementation plan, and confirmed all hosting runs on free plans. |
| 24 Sep 2026 | Shared the clarification questions with the Incubyte team, who left the details to me; decided the answers and researched employee fields and pay components for the four countries. |
| 24 Sep 2026 | Updated the requirements, decisions, design, diagrams and implementation plan to match the answers. |
| 24 Sep 2026 | Confirmed the remaining design details: a change log, moving employees between countries, monthly cost from current pay, and the dashboard currency toggle. |
| 24 Sep 2026 | Step 00: started the Git repository with the base configuration files, a README outline, the project rules and all design documents, and pushed it to GitHub. |
| 24 Sep 2026 | Step 01: set up npm workspaces for the API, web app and shared package, with strict TypeScript, ESLint, Prettier, Vitest and root scripts to lint, type check, test and build. |
| 24 Sep 2026 | Step 02: added continuous integration with GitHub Actions that runs lint, format check, type check, tests and build on every push and pull request. |
| 24 Sep 2026 | Step 03: built the walking skeleton: an Express API with a health endpoint, security headers, request IDs, structured logs and problem details errors, and a React home page that shows the API status through the Vite proxy. |
| 24 Sep 2026 | Step 04: deployed the walking skeleton: the web app on Vercel with a same-origin /api rewrite, and the API on Render in the same region as the Neon database. |
| 24 Sep 2026 | Step 05: added the database: Drizzle schema and migrations for currencies, countries, pay frequencies, pay components, employees, pay changes, pay items, exchange rates and the change log, with reference data, the pay totals view, money and frequency helpers, a change log helper and database status in the health check. |
| 24 Sep 2026 | Step 06: added a repeatable seed script that loads 10,000 synthetic employees across the four countries, with pay components, one to three pay changes each, inactive employees and starting exchange rates. |
| 24 Sep 2026 | Step 07: added sign-in with Argon2id passwords and JWT session cookies, token version checks, login rate limits, the country scope helper and demo HR users, and a login page with protected routes, role-aware navigation and sign-out. |
| 24 Sep 2026 | Step 08: added forgot password and set password with single-use hashed tokens (30-minute reset, 72-hour invite), emails through Brevo with a console sender for development, and the matching web pages. |
| 24 Sep 2026 | Step 09: added user management for global HR users: add users with an emailed invite, edit role and country, resend invites, deactivate and reactivate, with every change in the change log; protected the main branch with a GitHub ruleset. |
| 24 Sep 2026 | Step 10: added exchange rates from Frankfurter with a daily GitHub Actions refresh and a manual refresh for global HR, an exact conversion helper, and a currency toggle with rate dates and an out-of-date notice in the web app. |
| 24 Sep 2026 | Step 11: added the employee directory: search, filters, sorting by annual total in US dollars, paging and the inactive option in the API within each user's scope, and a page that keeps every filter in the URL, with styled dropdowns built on Radix Select. |
| 24 Sep 2026 | Step 12: added the employee record: create, read and update endpoints with per-country regions and fields, unique employee codes, consistent job title and department spelling, marking inactive with a date, and the change log, plus the employee page, create and edit forms, and the inactive action in the web app. |
| 25 Sep 2026 | Step 13: added pay: current pay with monthly and annual totals, pay history, pay changes that change, add or end components (including future-dated ones), starting pay for new employees, moves between countries for global HR, and the pay component list, with the pay section, history, pay change and move dialogs on the employee page. |
| 25 Sep 2026 | Step 14: added the pay component catalogue: HR users add components with a category, country and usual frequency, rename, deactivate and reactivate them within their scope, with codes unique among the components each country can use and every change in the change log. |
| 25 Sep 2026 | Step 15: added the dashboard with headcount and cost, pay range per country, cost per department, pay per job title and peer outliers, worked out in the database within each user's scope and shown as charts and tables. |
| 25 Sep 2026 | Step 16: added export of employees and current pay to Excel and CSV, following the directory filters and each user's scope, streamed in batches with formula-safe cells. |
| 25 Sep 2026 | Step 17: added import of employees and current pay from Excel and CSV files, with templates, a check that lists every problem by row and column, and an all-or-nothing save within each user's scope. |
| 25 Sep 2026 | Step 18: reviewed security, accessibility and quality: a scope test over every route, security headers for the web app, error logs without query values, limits on import and export, automated accessibility checks with fixes, page-by-page loading and a header that fits phones. |
| 25 Sep 2026 | Step 19: added an end-to-end smoke test with Playwright that signs in, searches for an employee, records a pay change, checks the dashboard and switches currency, run in CI against a PostgreSQL service. |
| 25 Sep 2026 | Step 20: measured the main screens with the seeded data, locally and on the live app, all within the 500 ms target; import checks now read only the employees in the file, and import and export are paused on the free hosting, where large files overload the server. |
| 26 Sep 2026 | Step 21: released the application: checked the live deployment, its security headers and daily exchange rates, walked through it as global and country HR users, and completed the README with the demo logins and a guide to trying it. |
