# Salary Management for ACME HR: Requirements

Author: Vineet Kumar | Date: 24 Sep 2026 | Version: 1.1 (based on the answered clarification questions and follow-up decisions)

## Goal

Replace ACME's salary spreadsheets with a web application where HR managers maintain pay data for 10,000 employees in India, the USA, Canada and Australia, and see how the organisation pays people on a dashboard, without exporting to Excel.

## Users

- **Global HR manager:** sees and manages all countries, and manages users and shared pay components.
- **Country HR manager:** sees and manages employees and pay for one country only.

## In scope

| # | Feature | What it includes |
|---|---|---|
| F1 | Access | Email and password login (JWT in an httpOnly cookie), forgot and reset password by email (Brevo), two roles with country scope, user management with email invites. |
| F2 | Employee directory | Paged list with search, filters (country, region, department, job title, employment type) and sorting. Inactive employees hidden unless included. |
| F3 | Employee record | Create, view and edit employees with the fields researched per country. Mark as inactive instead of deleting. A change log keeps every change and who made it. Global HR can move an employee to another country. |
| F4 | Pay components | Each employee's pay is a set of components with amount and frequency (weekly to yearly), shown as monthly equivalent and annual total. HR can add new components. |
| F5 | Pay history | Every pay change is dated, has a reason, and is kept. Current pay comes from the latest effective change. |
| F6 | Exchange rates | USD rates for CAD, AUD and INR refreshed daily by a scheduled job. A toggle shows amounts in USD or local currency. Org-wide totals are in USD. |
| F7 | Dashboard | Pay range per country, average pay per job title within a country, total cost per department, monthly and annual cost, and employees paid more than 20% above or below their peers. A country view toggles between USD and local currency. |
| F8 | Import and export | Excel (two sheets: employees, pay components) and CSV. Every row is checked with row-level errors; nothing is saved unless the whole file is valid. Built and tested, and paused on the free hosting plan, where large files use up the server (D59). |
| F9 | Seed data | Repeatable script for 10,000 synthetic employees: India 60%, USA 15%, Canada 15%, Australia 10%, all employment types. |

## Quality bar

- Money is stored as whole minor units with its currency code, never as floating point numbers.
- Country scope is enforced by the API on every request, not only hidden in the UI.
- Input is validated in the UI and again in the API. Passwords are hashed; reset and invite links are single use and expire.
- Paging, filtering and statistics run in the database, so screens respond in under 500 ms with 10,000 employees.
- Fast, deterministic tests cover business rules, statistics, access rules and API handlers, plus an end-to-end smoke test.
- Deployed and reachable by URL, with a one-command local setup, small incremental commits and a demo video.

## Deliberately left out, and why

| Left out | Reason |
|---|---|
| Payroll processing: tax, deductions, net pay, payslips, recording actual payments | Out of scope (Q10). Monthly cost is worked out from current pay instead. Payroll products cover this. |
| Calculating employer contributions from rates | Stored as amounts, so yearly rule changes need no code. Can be added later as its own module. |
| Government IDs, bank details, date of birth, gender | Not needed for pay data or insights, and each adds privacy risk. |
| Approval workflows, SSO, employee self-service | The two HR roles cover the stated users. |
| Pay bands and review cycles | Next step after the dashboard, on the same data. |
| Attendance, leave, benefits administration, performance | Separate HR domains outside the problem statement. |
