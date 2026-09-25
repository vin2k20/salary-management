import { formatMoney } from '@salary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, indiaHrUser, mockApi } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { chooseOption } from '../test/select.ts';

const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' });
const inr = (amountMinor: number) => ({ amountMinor, currency: 'INR' });

const rates = {
  rateDate: '2026-09-24',
  rates: { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' },
  stale: false,
};

function summary(query: URLSearchParams) {
  const country = query.get('country');
  const base = {
    measure: query.get('measure') ?? 'total',
    currency: query.get('currency') ?? 'local',
    withoutPay: 3,
  };
  if (country === 'IN') {
    return {
      ...base,
      rateDate: null,
      countryCode: 'IN',
      headcount: 5721,
      annualCost: inr(1_057_664_889_100),
      monthlyCost: inr(88_138_740_758),
      countries: [
        {
          countryCode: 'IN',
          headcount: 5721,
          annualCost: inr(1_057_664_889_100),
          monthlyCost: inr(88_138_740_758),
        },
      ],
    };
  }
  return {
    ...base,
    rateDate: '2026-09-24',
    countryCode: null,
    headcount: 9500,
    annualCost: usd(17_225_331_250),
    monthlyCost: usd(1_435_444_271),
    countries: [
      {
        countryCode: 'IN',
        headcount: 5721,
        annualCost: inr(1_057_664_889_100),
        monthlyCost: inr(88_138_740_758),
      },
      {
        countryCode: 'US',
        headcount: 1413,
        annualCost: usd(2_076_478_310),
        monthlyCost: usd(173_039_859),
      },
    ],
  };
}

const range = (countryCode: string, money: (amount: number) => object, values: number[]) => ({
  countryCode,
  headcount: values[0],
  minimum: money(values[1] ?? 0),
  lowerQuartile: money(values[2] ?? 0),
  median: money(values[3] ?? 0),
  upperQuartile: money(values[4] ?? 0),
  maximum: money(values[5] ?? 0),
  average: money(values[6] ?? 0),
});

const indiaRange = range(
  'IN',
  inr,
  [5721, 25_016_300, 86_747_500, 136_464_000, 233_744_400, 1_135_518_300, 184_874_128],
);
const usRange = range(
  'US',
  usd,
  [1413, 2_647_900, 9_925_800, 13_539_500, 18_523_500, 42_368_800, 14_695_529],
);

function payRanges(query: URLSearchParams) {
  return {
    measure: 'total',
    currency: 'local',
    rateDate: null,
    items: query.get('country') === 'IN' ? [indiaRange] : [indiaRange, usRange],
  };
}

const departments = {
  measure: 'total',
  currency: 'local',
  rateDate: '2026-09-24',
  countryCode: null,
  items: [
    {
      department: 'Engineering',
      headcount: 2905,
      annualCost: usd(18_288_463_887),
      monthlyCost: usd(1_524_038_657),
    },
    {
      department: 'Sales',
      headcount: 1135,
      annualCost: usd(5_785_285_680),
      monthlyCost: usd(482_107_140),
    },
  ],
};

function jobTitles(query: URLSearchParams) {
  return {
    measure: 'total',
    currency: 'local',
    rateDate: null,
    countryCode: query.get('country') ?? 'IN',
    items: [
      {
        jobTitle: 'Account Executive',
        headcount: 221,
        average: inr(107_201_286),
        median: inr(109_492_800),
        minimum: inr(60_000_000),
        maximum: inr(180_000_000),
      },
    ],
  };
}

function outliers(query: URLSearchParams) {
  const page = Number(query.get('page') ?? '1');
  return {
    measure: 'total',
    currency: 'local',
    rateDate: null,
    page,
    pageSize: 25,
    total: 567,
    limitPercent: 20,
    minimumGroupSize: 5,
    items: [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        employeeCode: page === 1 ? 'IN00926' : 'US00124',
        firstName: 'Aarav',
        lastName: page === 1 ? 'Sharma' : 'Stone',
        countryCode: 'IN',
        jobTitle: 'Software Engineer',
        employmentType: 'full_time',
        annualPay: inr(200_000_000),
        peerMedian: inr(123_839_009),
        peerCount: 13,
        differencePercent: 61.5,
        direction: 'above',
      },
    ],
  };
}

function dashboardApi(user: typeof globalHrUser | typeof indiaHrUser = globalHrUser) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user }),
    'GET /api/fx-rates/latest': () => Response.json(rates),
    'GET /api/insights/summary': ({ query }) => Response.json(summary(query)),
    'GET /api/insights/pay-range-by-country': ({ query }) => Response.json(payRanges(query)),
    'GET /api/insights/cost-by-department': () => Response.json(departments),
    'GET /api/insights/by-job-title': ({ query }) => Response.json(jobTitles(query)),
    'GET /api/insights/outliers': ({ query }) => Response.json(outliers(query)),
  });
}

/** The value shown under a summary figure's label. */
function figure(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
}

/** The text of each cell in a table row, in order. */
function cells(row: HTMLElement) {
  return Array.from(row.children).map((cell) => cell.textContent);
}

function section(name: string) {
  return screen.getByRole('region', { name });
}

/** The query strings sent to one endpoint, most recent last. */
function queriesTo(calls: { path: string; query: string }[], path: string) {
  return calls.filter((call) => call.path === path).map((call) => call.query);
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows org-wide totals in US dollars and every section for all countries', async () => {
    const { calls } = dashboardApi();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => {
      expect(figure('Employees')).toBe('9,500');
    });
    expect(figure('Annual cost')).toBe(formatMoney(17_225_331_250, 'USD'));
    expect(figure('Monthly cost')).toBe(formatMoney(1_435_444_271, 'USD'));
    expect(
      screen.getByText('Organisation totals are in US dollars at rates of 24 Sep 2026.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('3 employees have no current pay and are left out of pay figures.'),
    ).toBeInTheDocument();

    const byCountry = section('Cost by country');
    expect(cells(within(byCountry).getByRole('row', { name: /^India/ }))).toEqual([
      'India',
      '5,721',
      formatMoney(88_138_740_758, 'INR'),
      formatMoney(1_057_664_889_100, 'INR'),
    ]);

    const ranges = section('Pay range by country');
    expect(within(ranges).getByRole('figure', { name: /pay range/i })).toBeInTheDocument();
    expect(cells(within(ranges).getByRole('row', { name: /^United States/ }))).toEqual([
      'United States',
      '1,413',
      formatMoney(2_647_900, 'USD'),
      formatMoney(9_925_800, 'USD'),
      formatMoney(13_539_500, 'USD'),
      formatMoney(18_523_500, 'USD'),
      formatMoney(42_368_800, 'USD'),
      formatMoney(14_695_529, 'USD'),
    ]);

    const byDepartment = section('Cost by department');
    expect(cells(within(byDepartment).getByRole('row', { name: /^Engineering/ }))).toEqual([
      'Engineering',
      '2,905',
      formatMoney(1_524_038_657, 'USD'),
      formatMoney(18_288_463_887, 'USD'),
    ]);

    // Job titles are compared within a country: global HR users pick one, the first by default.
    const titles = section('Pay by job title');
    expect(
      within(titles).getByRole('combobox', { name: 'Country for job titles' }),
    ).toHaveTextContent('United States');
    expect(
      await within(titles).findByRole('row', { name: /^Account Executive/ }),
    ).toBeInTheDocument();
    expect(queriesTo(calls, '/api/insights/by-job-title').at(-1)).toContain('country=US');

    const peers = section('Pay compared with peers');
    expect(
      within(peers).getByText(
        /more than 20% above or below the median pay of their peers.*groups of at least 5/,
      ),
    ).toBeInTheDocument();
    const outlier = await within(peers).findByRole('row', { name: /Sharma/ });
    expect(cells(outlier)).toEqual([
      'Aarav SharmaIN00926',
      'India',
      'Software Engineer',
      'Full-time',
      formatMoney(200_000_000, 'INR'),
      formatMoney(123_839_009, 'INR'),
      '+61.5% above',
      '13',
    ]);
    expect(within(outlier).getByRole('link', { name: /Aarav Sharma/ })).toHaveAttribute(
      'href',
      '/employees/a0000000-0000-4000-8000-000000000001',
    );
    expect(within(peers).getByText('Showing 1 to 25 of 567')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Exchange rates' })).toBeInTheDocument();
    expect(queriesTo(calls, '/api/insights/summary')[0]).toBe('?measure=total&currency=local');
  });

  it('shows one country when chosen, keeping the choice in the URL', async () => {
    const user = userEvent.setup();
    const { calls } = dashboardApi();
    const { router } = renderApp('/');
    await waitFor(() => {
      expect(figure('Employees')).toBe('9,500');
    });

    await chooseOption(user, 'Country', 'India');

    await waitFor(() => {
      expect(figure('Annual cost')).toBe(formatMoney(1_057_664_889_100, 'INR'));
    });
    expect(router.state.location.search).toBe('?country=IN');
    expect(queriesTo(calls, '/api/insights/summary').at(-1)).toBe(
      '?country=IN&measure=total&currency=local',
    );
    expect(queriesTo(calls, '/api/insights/by-job-title').at(-1)).toContain('country=IN');
    expect(screen.queryByRole('region', { name: 'Cost by country' })).not.toBeInTheDocument();
    expect(
      within(section('Pay by job title')).queryByRole('combobox', {
        name: 'Country for job titles',
      }),
    ).not.toBeInTheDocument();
  });

  it('switches to gross pay and includes inactive employees when asked', async () => {
    const user = userEvent.setup();
    const { calls } = dashboardApi();
    renderApp('/');
    await waitFor(() => {
      expect(figure('Employees')).toBe('9,500');
    });

    await user.click(screen.getByRole('button', { name: 'Gross pay' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include inactive employees' }));

    await waitFor(() => {
      expect(figure('Annual gross pay')).toBe(formatMoney(17_225_331_250, 'USD'));
    });
    expect(screen.getByRole('button', { name: 'Gross pay' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const path of [
      '/api/insights/summary',
      '/api/insights/pay-range-by-country',
      '/api/insights/cost-by-department',
      '/api/insights/by-job-title',
      '/api/insights/outliers',
    ]) {
      expect(queriesTo(calls, path).at(-1), path).toContain('measure=gross');
      expect(queriesTo(calls, path).at(-1), path).toContain('includeInactive=true');
    }
  });

  it('asks for amounts in US dollars when the currency toggle says so', async () => {
    const user = userEvent.setup();
    const { calls } = dashboardApi();
    renderApp('/?country=IN');
    await waitFor(() => {
      expect(figure('Employees')).toBe('5,721');
    });

    await user.click(screen.getByRole('button', { name: 'USD' }));

    await waitFor(() => {
      expect(queriesTo(calls, '/api/insights/summary').at(-1)).toContain('currency=USD');
    });
    expect(queriesTo(calls, '/api/insights/outliers').at(-1)).toContain('currency=USD');
  });

  it('pages through outliers and filters them by direction', async () => {
    const user = userEvent.setup();
    const { calls } = dashboardApi();
    renderApp('/');
    const peers = await screen.findByRole('region', { name: 'Pay compared with peers' });
    await within(peers).findByRole('row', { name: /Sharma/ });

    await user.click(within(peers).getByRole('button', { name: 'Next page' }));
    expect(await within(peers).findByRole('row', { name: /Stone/ })).toBeInTheDocument();
    expect(queriesTo(calls, '/api/insights/outliers').at(-1)).toContain('page=2');

    await chooseOption(user, 'Show', 'Paid below peers');
    await waitFor(() => {
      expect(queriesTo(calls, '/api/insights/outliers').at(-1)).toContain('direction=below');
    });
    expect(queriesTo(calls, '/api/insights/outliers').at(-1)).toContain('page=1');
  });

  it('shows a country HR user their own country without a country choice', async () => {
    const { calls } = dashboardApi(indiaHrUser);
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('India', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Country' })).not.toBeInTheDocument();
    await within(section('Pay by job title')).findByRole('row', { name: /^Account Executive/ });
    expect(queriesTo(calls, '/api/insights/by-job-title').at(-1)).not.toContain('country=');
  });
});
