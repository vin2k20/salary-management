# Salary Management for ACME HR: Possible Improvements

Author: Vineet Kumar | Date: 26 Sep 2026 | Version: 1.0

The application covers everything in the [requirements](requirements.md): two HR roles with country scope, employees with country fields, pay as components with history, daily exchange rates with a currency toggle, the dashboard, and import and export (built, and paused on the free hosting). This document lists what would make it more useful next, in a suggested order, and how each item builds on the current design.

## 1. Suggested order

| Order | Improvement | Why first | Size |
|---|---|---|---|
| 1 | Switch import and export back on | Already built and tested; only the hosting holds it back | Small to medium |
| 2 | Monthly pay tracking | Answers "was everyone paid this month?", which the brief's spreadsheets cannot | Medium |
| 3 | Pay review cycles with approval | Turns yearly raises from spreadsheet work into a guided flow | Medium to large |
| 4 | Pay bands and compa-ratio | Makes the peer comparison sharper and explainable | Medium |
| 5 | Trends, forecasts and scheduled reports | Shows how cost moves over time, not just today | Medium |
| 6 | Reminders and alerts | Catches due increments, contract ends and missed payments early | Small to medium |
| 7 | More roles and single sign-on | Lets finance and managers use the app safely | Medium |
| 8 | Audit, privacy and compliance | Needed before real employee data goes in | Medium |
| 9 | Payroll and HR system integrations | Removes double entry | Medium to large |
| 10 | Operations and usability | Smooth daily use and room to grow | Small items, ongoing |

## 2. Switch import and export back on

Today a whole-organisation file takes over 10 seconds of the free API's tenth of a CPU, so the host restarts it ([performance check](performance.md), D59). To switch them on:

- **Background jobs.** Save the uploaded file, check and import it in a worker (a jobs table in PostgreSQL is enough at this size), and show progress on the Import page. Other users are never held up, and large files are no problem.
- **Or a larger API plan with batched checks.** Check rows in batches that let other requests run in between, and move to a plan with a full CPU.
- **Streaming reads** for CSV files, so memory stays flat for very large files.
- Then set `FILE_TRANSFERS=enabled` on the API and `VITE_FILE_TRANSFERS=enabled` for the web build. The code and its tests are already in place.

## 3. Monthly pay tracking

The app knows what each employee should be paid (current pay, monthly equivalent) but not what was actually paid, which was left out with payroll (Q10). Tracking payments, without calculating payroll, would add:

- **Pay runs.** One run per country and month, listing each active employee with the expected amount from their pay on that date.
- **Payment status per employee:** pending, paid, on hold or failed, with the paid date, amount and a payment reference.
- **Marking payments** one by one, in bulk, or by importing the bank or payroll provider's payment file, matched by employee code.
- **Differences flagged:** paid amount different from expected, employees not paid by the pay date, payments to inactive employees.
- **Dashboard:** paid and unpaid counts this month, expected against actual cost per country and department, and late payments.
- Every status change goes to the change log, like every other change today.

## 4. Pay review cycles with approval

- **Review cycles.** A yearly or mid-year cycle with an effective date and a budget per country or department.
- **Proposals.** Country HR proposes raises and promotions; the budget used and the new compa-ratio (item 5) update as they type.
- **Approval.** Global HR approves or sends back proposals. Approved proposals become ordinary pay changes on the effective date, so history, totals and the dashboard work as today.
- **Maker and checker for large changes.** A pay change above a set percentage needs a second person to approve it.

## 5. Pay bands and compa-ratio

- **Bands** (minimum, midpoint, maximum) per country, job title and level, kept as dated data like pay.
- **Compa-ratio** (pay divided by the band midpoint) on the employee page, in the directory and on the dashboard.
- **Band outliers** next to today's peer outliers: employees below the band minimum or above the maximum.
- **Band spread per country and job title** as a chart, using the existing statistics queries.

## 6. Trends, forecasts and scheduled reports

- **Trends over time.** Monthly cost, headcount and average pay per country and department for the last 12 or 24 months, worked out from the dated pay history that is already stored.
- **Joiners and leavers** per month from hire and inactive dates.
- **Forecast.** Next year's cost including scheduled pay changes, planned hires and exchange rate scenarios.
- **Scheduled reports.** A monthly cost summary as Excel or PDF, emailed to chosen users through the existing email service.
- **Pay equity reports** would need gender, which is left out on purpose today for privacy; adding it needs a privacy review and clear consent first.

## 7. Reminders and alerts

- Increments and probation reviews due, from the last pay change and hire dates.
- Contracts and internships ending soon.
- Exchange rates older than three days (shown today on the dashboard) sent by email as well.
- Unpaid or late payments once pay tracking (item 3) exists.
- A weekly email digest per HR user, within their country scope.

## 8. More roles and single sign-on

- **Finance:** read-only access to cost figures and reports, no personal details.
- **Line managers:** their own team only, with a new "team" scope next to the country scope.
- **Employees:** a read-only view of their own pay and history.
- **Single sign-on** with Microsoft or Google and multi-factor authentication, keeping email and password as a fallback.
- The scope helper that every query already takes is the place to add these rules.

## 9. Audit, privacy and compliance

- **Change log viewer** for global HR: filter by user, record and date, and export it.
- **Row-level security** in PostgreSQL as a second layer behind the application's country scope.
- **Encryption of pay amounts at rest** at field level, and keys held outside the database.
- **Retention rules** for leavers' data, with anonymisation after the legal period in each country.
- **Data requests:** export or erase one person's data on request.
- **Security reviews:** dependency alerts, a yearly penetration test, and the screen reader check left open in the [checklist](quality-checklist.md).

## 10. Payroll and HR system integrations

- **Payroll products** (such as greytHR, Keka, ADP or Gusto): send approved pay changes by API or file, and read back payments for pay tracking (item 3).
- **HR systems:** keep employees in step with the company's HR system instead of entering them twice.
- **Accounting:** monthly cost per department as a journal file for the finance system.
- **An API for other tools**, documented with OpenAPI generated from the shared Zod schemas.

## 11. Operations and usability

- **Always-on hosting.** A paid API plan removes the minute-long wake-up after a quiet period and gives import and export the CPU they need.
- **Monitoring:** error tracking (such as Sentry), uptime checks and alerts for the daily rates job.
- **Growth:** stored pay totals, materialized views for the dashboard and keyset paging, the upgrade paths already named in the [design approach](design-approach-and-trade-offs.md).
- **More countries:** countries, currencies, regions and pay components are data, so a new country needs its fields and seed components, not new screens.
- **Everyday use:** saved directory views, bulk edits (for example, moving a team to a new department), and a "follow the device" option for the theme.
- **Local formats:** dates and numbers in each user's local style, for example lakh and crore grouping for India.
