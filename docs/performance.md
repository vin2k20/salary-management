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

## Production

Measured on 25 Sep 2026 from India against the live app (web app on Vercel; API on Render's free plan and database on Neon's free plan, both in Ohio), as global HR, 10 runs each. The sign-in check does almost no work, so its time is mostly the network between India and Ohio; the server time is estimated as the median minus that baseline.

| Endpoint | Median ms | Server time, estimated ms |
|---|---|---|
| Sign-in check (baseline) | 284 | |
| Exchange rates | 332 | 48 |
| Filter choices | 276 | under 10 |
| Directory, first page | 349 | 65 |
| Directory, by annual total in US dollars | 413 | 129 |
| Directory, name search | 350 | 66 |
| Directory, filtered by department and type | 342 | 58 |
| Directory, last page with inactive employees | 357 | 73 |
| Employee, pay, pay history and change log | 275 to 297 | under 15 |
| Dashboard summary | 335 | 51 |
| Dashboard pay range | 355 | 71 |
| Dashboard departments | 347 | 63 |
| Dashboard job titles | 339 | 55 |
| Dashboard outliers | 433 | 149 |

Every median is under 500 ms, network included; single runs reached 767 ms at most. The server's own time for the directory and the dashboard is 50 to 150 ms, so the pay totals stay worked out on each request, with no new index and no stored totals (HLD 8).

## Import and export on the free plan

Timed on production before the changes below, as global HR with files for all 10,000 employees:

- The three exports finished.
- Each check of the employees file took 10.2 to 10.8 seconds on the API (0.36 s on the local setup): the free plan has a tenth of a CPU.
- While the pay file (about 58,000 rows) was being checked, the API could not answer Render's health checks: a check runs in one go on the API's single thread, so even the health check's database connection timed out. Render then restarted the API, and the import check ended with a 502.

## Changes

- **Import checks read only the employees the file names.** Their codes go to the database as one array parameter, since a file can name more employees than a query can have parameters. A file with 10 employees now takes 5 ms instead of 180 ms (4 ms instead of 130 ms for India HR) on the local setup; files for everyone take as long as before.
- **Import and export are paused by default** (D59). The API answers 503 unless `FILE_TRANSFERS=enabled`, and the web app shows both as built but paused unless it is built with `VITE_FILE_TRANSFERS=enabled`. The code and its tests stay, so they can be switched on with a larger server.
- **Directory and dashboard:** no change needed.

## Before switching import and export on again

- A larger API plan, or checking files in batches that let other requests run in between (or in a worker thread), so a large file cannot hold the API.
- Time a whole-organisation import and export on the new setup with `npm run time-endpoints -w @salary/api -- --url <address> --email <user> --files`.
