# Salary Management for ACME HR: Performance Check

Author: Vineet Kumar | Date: 25 Sep 2026 | Step 20 of the implementation plan

This records how fast the main screens respond with the seeded data, where the time goes, and what was changed. The target (HLD 8) is list and dashboard responses under 500 ms with 10,000 employees.

## How it was measured

- **Data:** the seed data set: 10,000 employees (9,500 active), 18,390 pay changes and 113,642 pay items, of which 60,805 are in force today.
- **Endpoints:** `npm run time-endpoints -w @salary/api -- --url <address> --email <user>` signs in as an HR user and times the main read endpoints: 10 runs each, 3 for files, since imports and exports are rate limited. The password comes from `TIME_PASSWORD` or a hidden prompt. Only reads: an import is checked, never saved. Times include the network, so the sign-in check is timed as a baseline.
- **Database:** each endpoint's SQL, replayed with `EXPLAIN ANALYZE` (execution time, best of three).
- **Local setup:** the API on an Apple silicon laptop with PostgreSQL 15 on the same machine, so there is almost no network time.

## Baseline

Median response times in milliseconds, on the local setup.

| Endpoint | Global HR | India HR |
|---|---|---|
| Sign-in check (baseline) | 1 | 1 |
| Filter choices | 3 | 3 |
| Directory, first page | 46 | 43 |
| Directory, by annual total in US dollars | 45 | 42 |
| Directory, name search | 43 | 41 |
| Directory, filtered by department and type | 38 | 38 |
| Directory, last page with inactive employees | 66 | 54 |
| Employee, pay, pay history and change log | 1 to 2 | 1 to 2 |
| Dashboard summary | 39 | 39 |
| Dashboard pay range | 42 | 40 |
| Dashboard departments | 40 | 39 |
| Dashboard job titles | 44 | 44 |
| Dashboard outliers | 60 | 50 |
| Export, Excel (both sheets) | 1,348 | 887 |
| Export, employees CSV | 52 | 36 |
| Export, pay CSV | 299 | 203 |
| Import check, 10 employees CSV | 180 | 130 |
| Import check, all employees CSV | 316 | 208 |
| Import check, all pay CSV | 403 | 258 |

## Where the time goes

- **Pay totals.** The directory and every dashboard section read today's totals from `pay_totals_on(date)`, which adds up the pay items in force for every employee: one scan of the pay items, grouped by employee, about 41 ms of the directory query's 50 ms. The country filter and the page apply after the totals are worked out, so India HR's directory costs about the same as global HR's. The rest of each query takes a few milliseconds.
- **One query per request.** The directory and each dashboard section run one totals query each; the outliers section runs two at the same time (the page and the count). The employee page reads one employee and needs no totals over everyone.
- **Import check.** Checking a file reads every employee, pay item in force and latest pay change in the user's scope, whatever the file holds. A file with 10 employees takes 180 ms, most of it spent loading 10,000 employees and their pay.
- **Excel export.** The CSV files for the same rows take about 0.35 s together, so most of the 1.3 s is spent writing the Excel file.
