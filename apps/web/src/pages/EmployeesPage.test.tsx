import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, indiaHrUser, mockApi } from '../test/mock-api.ts';
import { expectNoAccessibilityProblems } from '../test/axe.ts';
import { renderApp } from '../test/render-app.tsx';
import { chooseOption } from '../test/select.ts';

const reference = {
  countries: [
    { code: 'IN', name: 'India', currencyCode: 'INR' },
    { code: 'US', name: 'United States', currencyCode: 'USD' },
  ],
  regions: [
    { countryCode: 'IN', name: 'Karnataka' },
    { countryCode: 'US', name: 'Texas' },
  ],
  departments: ['Engineering', 'Sales'],
  jobTitles: ['Account Executive', 'Software Engineer'],
  employmentTypes: ['full_time', 'part_time', 'contractor', 'intern'],
};

const aarav = {
  id: '11111111-1111-4111-8111-111111111111',
  employeeCode: 'IN00001',
  firstName: 'Aarav',
  lastName: 'Sharma',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  region: 'Karnataka',
  employmentType: 'full_time',
  status: 'active',
  annualTotal: { amountMinor: 120_000_000, currency: 'INR' },
  monthlyTotal: { amountMinor: 10_000_000, currency: 'INR' },
};

function directoryApi(
  user: typeof globalHrUser | typeof indiaHrUser = globalHrUser,
  list = () =>
    Response.json({
      items: [aarav],
      page: 1,
      pageSize: 50,
      total: 120,
      currency: 'local',
      rateDate: null,
    }),
) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user }),
    'GET /api/reference': () => Response.json(reference),
    'GET /api/employees': list,
  });
}

function lastListQuery(calls: { path: string; query: string }[]) {
  const listCalls = calls.filter((call) => call.path === '/api/employees');
  return new URLSearchParams(listCalls.at(-1)?.query ?? '');
}

describe('EmployeesPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is in the navigation and lists employees with their pay', async () => {
    directoryApi();
    renderApp('/employees');

    const table = await screen.findByRole('table');
    const row = within(table).getByText('Aarav Sharma').closest('tr');
    if (!row) throw new Error('No row');
    expect(within(row).getByText('IN00001')).toBeInTheDocument();
    expect(within(row).getByText('Karnataka, India')).toBeInTheDocument();
    expect(within(row).getByText('Full-time')).toBeInTheDocument();
    expect(within(row).getByText('₹1,200,000.00')).toBeInTheDocument();
    expect(within(row).getByText('₹100,000.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Showing 1 to 50 of 120')).toBeInTheDocument();
  });

  it('sends the filters in the URL to the API, so a bookmarked view loads the same', async () => {
    const { calls } = directoryApi();
    renderApp(
      '/employees?search=sharma&department=Engineering&includeInactive=true&sort=-annualTotal&page=2',
    );

    await screen.findByRole('table');
    const query = lastListQuery(calls);
    expect(Object.fromEntries(query)).toEqual({
      search: 'sharma',
      department: 'Engineering',
      includeInactive: 'true',
      sort: '-annualTotal',
      page: '2',
      pageSize: '50',
      currency: 'local',
    });
    expect(screen.getByLabelText('Search')).toHaveValue('sharma');
    expect(screen.getByRole('combobox', { name: 'Department' })).toHaveTextContent('Engineering');
    expect(screen.getByLabelText('Include inactive employees')).toBeChecked();
  });

  it('keeps a search in the URL and starts again from page 1', async () => {
    const { calls } = directoryApi();
    const { router } = renderApp('/employees?page=3');

    await userEvent.setup().type(await screen.findByLabelText('Search'), 'shar');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?search=shar');
    });
    await waitFor(() => {
      expect(lastListQuery(calls).get('search')).toBe('shar');
    });
  });

  it('keeps chosen filters in the URL', async () => {
    directoryApi();
    const { router } = renderApp('/employees');
    const user = userEvent.setup();

    await screen.findByRole('table');
    await chooseOption(user, 'Department', 'Sales');
    await chooseOption(user, 'Employment type', 'Contractor');
    await user.click(screen.getByLabelText('Include inactive employees'));

    expect(new URLSearchParams(router.state.location.search).toString()).toBe(
      'department=Sales&employmentType=contractor&includeInactive=true',
    );
  });

  it('sorts by annual total when its heading is clicked, highest first on the second click', async () => {
    directoryApi();
    const { router } = renderApp('/employees');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Annual total' }));
    expect(router.state.location.search).toBe('?sort=annualTotal');
    expect(screen.getByRole('columnheader', { name: /Annual total/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: 'Annual total' }));
    expect(router.state.location.search).toBe('?sort=-annualTotal');
  });

  it('moves between pages', async () => {
    directoryApi();
    const { router } = renderApp('/employees');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Next page' }));

    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('asks the API for US dollars and shows the rate date when the toggle says so', async () => {
    const { calls } = directoryApi(globalHrUser, () =>
      Response.json({
        items: [
          {
            ...aarav,
            annualTotal: { amountMinor: 1_250_521, currency: 'USD' },
            monthlyTotal: { amountMinor: 104_210, currency: 'USD' },
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        currency: 'USD',
        rateDate: '2026-09-24',
      }),
    );
    renderApp('/employees?currency=USD');

    expect(await screen.findByText('$12,505.21')).toBeInTheDocument();
    expect(screen.getByText('US dollars at rates of 24 Sep 2026')).toBeInTheDocument();
    expect(lastListQuery(calls).get('currency')).toBe('USD');
  });

  it('explains when nothing matches and clears the filters', async () => {
    directoryApi(globalHrUser, () =>
      Response.json({
        items: [],
        page: 1,
        pageSize: 50,
        total: 0,
        currency: 'local',
        rateDate: null,
      }),
    );
    const { router } = renderApp('/employees?search=nobody');

    expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument();
    const [clearButton] = screen.getAllByRole('button', { name: 'Clear filters' });
    if (!clearButton) throw new Error('No Clear filters button');
    await userEvent.setup().click(clearButton);

    expect(router.state.location.search).toBe('');
  });

  it('does not offer a country filter to country HR users', async () => {
    directoryApi(indiaHrUser);
    renderApp('/employees');

    await screen.findByRole('table');
    expect(screen.queryByRole('combobox', { name: 'Country' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Region' })).toBeInTheDocument();
  });
});

describe('EmployeesPage dropdowns', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows "All" when a filter is not set and clears it again', async () => {
    directoryApi();
    const { router } = renderApp('/employees?department=Sales');
    const user = userEvent.setup();

    await screen.findByRole('table');
    await chooseOption(user, 'Department', 'All departments');

    expect(screen.getByRole('combobox', { name: 'Department' })).toHaveTextContent(
      'All departments',
    );
    expect(router.state.location.search).toBe('');
  });

  it('changes the rows per page', async () => {
    directoryApi();
    const { router } = renderApp('/employees');

    await screen.findByRole('table');
    await chooseOption(userEvent.setup(), 'Rows per page', '100');

    expect(router.state.location.search).toBe('?pageSize=100');
  });
});

describe('EmployeesPage export', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FILE_TRANSFERS', 'enabled');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('offers Excel and CSV downloads of the filtered employees and their pay', async () => {
    directoryApi();
    renderApp(
      '/employees?country=IN&department=Engineering&includeInactive=true&sort=-name&page=3',
    );
    const user = userEvent.setup();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Export' }));

    const filters = 'country=IN&department=Engineering&includeInactive=true';
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toEqual([
      ['Excel: employees and pay', `/api/exports?format=xlsx&${filters}`],
      ['CSV: employees', `/api/exports?format=csv&dataset=employees&${filters}`],
      ['CSV: pay components', `/api/exports?format=csv&dataset=pay&${filters}`],
    ]);
    for (const item of items) expect(item).toHaveAttribute('download');
  });

  it('exports everything in scope when no filter is set', async () => {
    directoryApi(indiaHrUser);
    renderApp('/employees');
    const user = userEvent.setup();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Export' }));

    expect(await screen.findByRole('menuitem', { name: 'CSV: employees' })).toHaveAttribute(
      'href',
      '/api/exports?format=csv&dataset=employees',
    );
  });
});

describe('EmployeesPage accessibility', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FILE_TRANSFERS', 'enabled');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('has no accessibility problems, with the export menu open', async () => {
    directoryApi();
    renderApp('/employees');
    await screen.findByRole('table');
    await expectNoAccessibilityProblems();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' }));
    await screen.findAllByRole('menuitem');
    await expectNoAccessibilityProblems();
  });
});

describe('EmployeesPage export while paused', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows export as built but paused, with the reason', async () => {
    directoryApi();
    renderApp('/employees');
    await screen.findByRole('table');

    const button = screen.getByRole('button', { name: 'Export' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'Export is built but paused: limited server resources.',
    );
    expect(screen.getByText('Export is built but paused: limited server resources.')).toBeVisible();
  });
});
