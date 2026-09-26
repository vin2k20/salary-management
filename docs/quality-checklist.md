# Salary Management for ACME HR: Security and Accessibility Checklist

Author: Vineet Kumar | Date: 25 Sep 2026 | Step 18 of the implementation plan

This records the security, accessibility and quality review before release: what was checked, how, the result, and what was fixed. Automated checks run in CI with every change.

## Security

| Area | How it was checked | Result |
|---|---|---|
| Country scope on every endpoint | `apps/api/src/scope-walk.test.ts` calls every signed-in route as an India HR user reaching for United States data, and fails when a route is added without a case (36 routes) | Pass: records outside the scope answer 404, global HR actions answer 403, lists and statistics leave other countries out |
| Web app headers | `vercel.json`, checked by `apps/web/src/security-headers.test.ts`; the policy was tried on the production build in a browser | Added: content security policy, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy and cross-origin opener policy. Vercel adds HSTS |
| Content security policy | Browser console on the built app with dropdowns, dialogs and charts open | Scripts, requests, fonts and frames from the app only. Styles allow `'unsafe-inline'`, since Radix writes small style elements to lock scrolling under dialogs and menus, and their content (the scrollbar width) changes, so hashes cannot be used |
| API headers | Live response headers | Helmet: content security policy, HSTS, `nosniff`, frame options, referrer policy |
| Session cookie | Login tests | httpOnly and SameSite=Lax; Secure in production (`NODE_ENV=production` on Render) |
| Cross-site requests | Design review and tests | Same-origin API, SameSite=Lax cookies, JSON bodies for changes, and the `X-Requested-With` header on file uploads |
| Rate limits | Tests | Sign-in: 5 failed attempts per email and 20 per IP address in 15 minutes. Reset emails: 3 per email and 10 per IP address. Set password: 20 per IP address. Added: 30 imports and 30 exports per user in 15 minutes |
| Body and upload limits | Code review and tests | JSON bodies up to 100 KB. Uploads: one file up to 10 MB and no other fields; Excel files up to 1 MB and 20,000 rows; CSV files up to 100,000 rows |
| Dependencies | `npm audit` | No high or critical advisories. Two moderate: `esbuild` inside `drizzle-kit`, a development tool whose dev server is never run; `uuid` inside ExcelJS, whose advisory covers v3, v5 and v6 with a buffer, while ExcelJS only calls v4 (D55) |
| Logs | Review of every log call, and `apps/api/src/http/error-logging.test.ts` | Request logs hold the method, path, status and request ID, never query strings or headers. Fixed: a failed database query logged its values (names, emails, pay); errors now keep the query, codes and stack only. The console email sender, which logs links, is refused in production |
| Secrets | Code and repository review | Environment variables only; `.env` files are ignored by Git |

## Accessibility

| Area | How it was checked | Result |
|---|---|---|
| Automated rules | axe-core in the page tests: sign-in (with errors), dashboard, directory (with the export menu), employee page, pay change dialog, add employee form (with errors), pay components (with the add form), users (with the add form) and import (with problems and with changes) | Pass. Fixed: the sign-in, forgot password and set password pages had no main landmark |
| Colour contrast | axe in the browser (jsdom cannot compute colours) on the dashboard, directory and pay components, in light and dark themes | Pass |
| Colour contrast, new themes (26 Sep 2026) | Contrast worked out for every text and control colour pair of both palettes, then axe in the browser on the dashboard, directory, an employee, pay components, users and import, in light and dark | Pass: text at least 5.1:1, focus ring and chart marks at least 5.2:1; no axe violations |
| Keyboard | Tabbing through the header, directory, filters, dropdowns and dialogs in the browser | Fixed: a "Skip to main content" link comes first, and the header's tab order now matches its layout. Focus is always visible; dialogs keep focus inside and close with Escape; dropdowns and menus work with the arrow keys |
| Screen reader structure | Accessibility tree in the browser | Header, main navigation and main landmarks; one H1 per page; named sections; charts are figures with captions, and every chart has a table of the same figures |
| Narrow screens | Browser at 375, 800 and 1,030 pixels wide | Fixed: the header overflowed on phones; it now has two rows, with the navigation scrolling sideways when needed |

## Quality

| Area | Result |
|---|---|
| Web bundle | Each signed-in page loads when first opened. The first download fell from 335 KB to 91 KB gzipped; the dashboard's charts (108 KB) load with the dashboard only |
| Loading, error and empty states | Every page shows loading and error states; lists that can be empty (directory, dashboard sections, pay history, change log, import) say so |

## Checked after release

| Area | How it was checked | Result |
|---|---|---|
| Response headers | `curl -I` on the production URL, 25 Sep 2026 | Pass: the web app sends every header in `vercel.json` and Vercel adds HSTS; the API sends Helmet's headers |
| Content security policy in use | Browser console during the release walk-through | Pass: no errors |
| Main paths for both roles | Walk-through on the production URL in a private window as global HR and India HR, 26 Sep 2026 | Pass: dashboard and currency switch, search, a pay change with its history and change log, the dashboard following it, India HR limited to India ("Employee not found" for a USA employee), import and export shown as paused |
| Narrow screens | Browser's responsive design mode | Pass |
| Screen reader | Not done with VoiceOver | Open; the structure was checked in the accessibility tree (see Accessibility) |
