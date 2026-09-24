# Salary Management for ACME HR: Clarification Questions and Answers

Author: Vineet Kumar | Date: 24 Sep 2026 | Version: 2.1 (answered, with follow-up decisions)

## Status

The clarification questions below were shared with the Incubyte team before building. The team replied that everything in the assessment brief is important and should be considered at each step, and left the detailed decisions to me. I then answered each question myself, acting as the product owner, and the requirements, design and plan follow these answers.

Where an answer needed more detail to build from, the detail I decided is listed under it.

## Users and access

**Q1. Users:** Will only the HR Manager use the application, or others too? Should some users see only part of the data, such as their own country?

**Answer:** There can be several HR managers. A global HR manager sees all data. A country HR manager sees only the data for their own country.

Details decided:

- Two roles: global HR and country HR. A country HR user is linked to one country.
- A global HR user manages the other users: add, change role or country, and deactivate. New users get an email link to set their own password.
- Country HR users can manage employees and pay for their own country only.

**Q2. Login:** Email and password login for HR (JWT based), with a "forgot password" link sent by email through Brevo?

**Answer:** JWT login is fine, and forgot and reset password is wanted.

## Salary data

**Q3. Salary definition:** What does "salary" mean in the current data?

**Answer:** Salary is made of several components. Monthly costs need to be managed, and the full annual picture needs to be covered too. HR must be able to add new components and set how often each is paid: weekly, bi-weekly, monthly, bi-monthly, quarterly, bi-quarterly, half-yearly or yearly.

Details decided:

- Each employee's pay is a set of components (for example basic, allowances, bonus, employer contributions), each with an amount, currency and frequency.
- The application shows each employee's monthly equivalent and annual total, and uses the annual total for insights.
- "Bi-" means "every two": bi-weekly is every two weeks (26 a year), bi-monthly every two months (6 a year), bi-quarterly every two quarters (2 a year). Frequencies are stored as data, so this can change without code changes.

**Q4. Current fields:** Which columns are in the current Excel sheets?

**Answer:** Research and use the best fields for each country. There are four countries: USA, Canada, Australia and India.

Details decided: see `research-country-pay-structures.md` for the employee fields and typical pay components per country. Government IDs, bank details, date of birth and gender are not stored.

**Q5. Countries and currency:** Which countries, which currencies, and which currency for org-wide figures?

**Answer:** USA, Canada, Australia and India, each in its own currency. Org-wide figures are in USD. A daily scheduled job refreshes the exchange rates. The dashboard and other screens show amounts in USD when a toggle is on, and in local currencies when it is off.

**Q6. Salary history:** Keep a history of salary changes, or only the current salary?

**Answer:** Keep the history of salary changes for each employee.

**Q7. Employee types:** Are contractors, interns or part-time staff included?

**Answer:** Yes. The 10,000 employees include full-time, part-time, contractor and intern staff, split by country as India 60%, USA 15%, Canada 15% and Australia 10%.

**Q8. Leavers:** Delete leavers or keep them as inactive?

**Answer:** Keep them as inactive. Inactive employees are hidden from views unless the user chooses to include them.

## Insights and scope

**Q9. Key questions:** Which pay questions matter most?

**Answer:** All of them: pay range per country, average pay per job title within a country, total salary cost per department, and employees paid well above or below their peers, shown together on a dashboard.

Details decided: an employee is flagged as paid well above or below peers when their annual total is more than 20% above or below the median of employees with the same country, job title and employment type. Groups with fewer than five employees are not flagged.

**Q10. Payroll processing:** Are tax deductions, net pay or payslips expected?

**Answer:** No. The application is for pay data and insights, designed so it can grow with new features later.

**Q11. Import and export:** Import and export in Excel (.xlsx) and CSV?

**Answer:** Yes, import and export are wanted.

Details decided: an Excel file has two sheets, Employees and Pay components. A CSV file holds one of the two, chosen when importing or exporting.

## Follow-up decisions

While reviewing the design, a few more points came up. I decided them on 24 Sep 2026, and confirmed the details listed under the answers above.

- **Change history for employee details:** changes to job title, department, level, employment type and other details are kept in a change log, along with pay and user changes: what changed, old and new values, who and when. The employee page shows it.
- **Moving an employee to another country:** allowed for global HR users only. The move ends the current pay and starts new pay in the new country's currency, recorded as one change.
- **Monthly expenses:** the monthly cost is worked out from current pay (the monthly equivalent of each component), with totals per country and department. Actual monthly payments are not recorded, as that is payroll (Q10).
- **Currency on the dashboard:** when viewing one country, a toggle switches between USD and that country's currency. Org-wide totals are always in USD.

## Tech stack

Chosen to match the role (React, Node.js, TypeScript, PostgreSQL, test-first development and browser testing).

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript for the API, the UI and shared code | One set of types and validation rules shared by API and UI |
| Backend | Node.js 24 LTS, Express 5, Zod for request validation | Express 5 handles errors from async code; Zod schemas are shared with the UI |
| Database | PostgreSQL with Drizzle ORM and versioned migrations | Built-in median and percentile functions for pay statistics |
| Frontend | React with Vite, TanStack Query and TanStack Table, shadcn/ui, Recharts | An internal tool behind a login does not need server rendering; the API and UI stay clearly separate |
| Login and email | JWT in an httpOnly cookie, Argon2id password hashing, Brevo for reset and invite emails | Token is not readable from page scripts |
| Exchange rates | Frankfurter API (central bank reference rates), refreshed daily by a scheduled GitHub Actions job | Free, no API key, covers USD, CAD, AUD and INR |
| Import and export | ExcelJS for .xlsx, csv-parse for CSV | Row-level validation using the same rules as the API |
| Testing | Test first with Vitest, Supertest, React Testing Library and PGlite; Playwright for an end-to-end smoke test | Fast, deterministic tests that run without Docker |
| CI and hosting | GitHub Actions; Neon for PostgreSQL, Render for the API, Vercel for the UI | Lint, type check and tests on every push; deploys from Git |
| AI tooling | Claude Code as a pair programmer, with project rules and a short project history in the repository | Makes AI use visible and reviewable |
