import { parseArgs } from 'node:util';
import {
  currentUserResponseSchema,
  employeeListResponseSchema,
  referenceDataSchema,
} from '@salary/shared';
import type { z } from 'zod';

// Usage: npm run time-endpoints -w @salary/api -- --url https://example.com --email user@example.com
// Signs in as the given HR user and times the main read endpoints, with the password from
// TIME_PASSWORD or typed at a hidden prompt. Only reads data. With --files, export and import
// checks are timed too (they must be enabled on the API); an import is checked, never saved.
// Times include the network, so the sign-in check (GET /api/auth/me) is timed too, as a baseline.
const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    email: { type: 'string', default: 'global.hr@acme.example.com' },
    runs: { type: 'string', default: '10' },
    files: { type: 'boolean', default: false },
    'file-runs': { type: 'string', default: '3' },
  },
});

const baseUrl = values.url.replace(/\/$/, '');
const runs = Number(values.runs);
// Imports and exports allow 30 requests per user in 15 minutes, so files are timed fewer times.
const fileRuns = Number(values['file-runs']);

async function readPassword(): Promise<string> {
  const fromEnv = process.env.TIME_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) throw new Error('Set TIME_PASSWORD or run in a terminal');
  process.stdout.write(`Password for ${values.email}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let typed = '';
  for await (const chunk of process.stdin) {
    const text = String(chunk);
    if (text === '\u0003') process.exit(130);
    if (text.includes('\r') || text.includes('\n')) break;
    typed = text === '\u007f' ? typed.slice(0, -1) : typed + text;
  }
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write('\n');
  return typed;
}

let cookie = '';

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} answered ${String(response.status)}`);
  }
  return response;
}

async function read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await (await call(path)).json());
}

interface Timing {
  name: string;
  times: number[];
  /** Runs that failed, with the error and how long they took, such as "502 after 31.2 s". */
  failures: string[];
}

async function time(
  name: string,
  count: number,
  request: () => Promise<Response>,
): Promise<Timing> {
  const times: number[] = [];
  const failures: string[] = [];
  for (let run = 0; run < count; run += 1) {
    const started = performance.now();
    try {
      const response = await request();
      await response.arrayBuffer();
      times.push(performance.now() - started);
    } catch (error) {
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      failures.push(`${error instanceof Error ? error.message : String(error)} after ${seconds} s`);
    }
  }
  return { name, times, failures };
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

function report(timings: Timing[]) {
  const rows = timings.map(({ name, times }) => {
    const sorted = times.toSorted((a, b) => a - b);
    return {
      endpoint: name,
      runs: times.length,
      'median ms': Math.round(median(sorted)),
      'min ms': Math.round(sorted[0] ?? 0),
      'max ms': Math.round(sorted.at(-1) ?? 0),
    };
  });
  console.table(rows);
  for (const { name, failures } of timings) {
    for (const failure of failures) console.log(`Failed: ${name}: ${failure}`);
  }
}

const password = await readPassword();
const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: values.email, password }),
});
if (!login.ok) throw new Error(`Sign-in answered ${String(login.status)}`);
cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
const { user } = await read('/api/auth/me', currentUserResponseSchema);
const country = user.countryCode ?? 'IN';

// Values for the requests below, taken from the data itself.
const reference = await read('/api/reference', referenceDataSchema);
const firstPage = await read('/api/employees', employeeListResponseSchema);
const employeeId = firstPage.items[0]?.id ?? '';
const lastPage = Math.ceil(firstPage.total / 50);
const department = encodeURIComponent(reference.departments[0] ?? '');

function validate(file: Blob, name: string) {
  const form = new FormData();
  form.append('file', file, name);
  return call('/api/imports/validate', {
    method: 'POST',
    body: form,
    headers: { 'x-requested-with': 'fetch' },
  });
}

const get = (path: string) => () => call(path);
const cases: [string, string][] = [
  ['Sign-in check (baseline)', '/api/auth/me'],
  ['Exchange rates', '/api/fx-rates/latest'],
  ['Filter choices', '/api/reference'],
  ['Directory, first page', '/api/employees'],
  ['Directory, by annual total in USD', '/api/employees?sort=-annualTotal&currency=USD'],
  ['Directory, name search', '/api/employees?search=sha'],
  ['Directory, filtered', `/api/employees?department=${department}&employmentType=full_time`],
  ['Directory, last page', `/api/employees?page=${String(lastPage)}&includeInactive=true`],
  ['Employee', `/api/employees/${employeeId}`],
  ['Employee pay', `/api/employees/${employeeId}/pay`],
  ['Employee pay history', `/api/employees/${employeeId}/pay-changes`],
  ['Employee change log', `/api/employees/${employeeId}/change-log`],
  ['Dashboard summary', '/api/insights/summary'],
  ['Dashboard pay range', '/api/insights/pay-range-by-country?currency=USD'],
  ['Dashboard departments', '/api/insights/cost-by-department'],
  ['Dashboard job titles', `/api/insights/by-job-title?country=${country}`],
  ['Dashboard outliers', '/api/insights/outliers'],
];

const timings: Timing[] = [];
for (const [name, path] of cases) {
  await call(path);
  timings.push(await time(name, runs, get(path)));
}
if (values.files) {
  const employeesCsv = await (await call('/api/exports?format=csv&dataset=employees')).blob();
  const payCsv = await (await call('/api/exports?format=csv&dataset=pay')).blob();
  // A small file, as most imports are: the header and the first ten employees.
  const tenLines = (await employeesCsv.text()).split('\r\n').slice(0, 11).join('\r\n');
  const smallCsv = new Blob([`${tenLines}\r\n`], { type: 'text/csv' });
  timings.push(
    await time('Export, Excel', fileRuns, get('/api/exports?format=xlsx')),
    await time('Export, employees CSV', fileRuns, get('/api/exports?format=csv&dataset=employees')),
    await time('Export, pay CSV', fileRuns, get('/api/exports?format=csv&dataset=pay')),
    await time('Import check, 10 employees CSV', fileRuns, () => validate(smallCsv, 'ten.csv')),
    await time('Import check, employees CSV', fileRuns, () =>
      validate(employeesCsv, 'employees.csv'),
    ),
    await time('Import check, pay CSV', fileRuns, () => validate(payCsv, 'pay.csv')),
  );
}

console.log(`${baseUrl} as ${user.email} (${user.role}), ${String(firstPage.total)} employees`);
report(timings);
