import { convertMinor, formatMoney } from '@salary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, indiaHrUser, mockApi, problem } from '../test/mock-api.ts';
import {
  components,
  currentPay,
  frequencies,
  ids,
  payHistory,
  payTotals,
  priya,
} from '../test/pay-data.ts';
import { renderApp } from '../test/render-app.tsx';
import { chooseOption } from '../test/select.ts';

const rates = { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' } as const;

function payApi(
  user: typeof globalHrUser | typeof indiaHrUser = globalHrUser,
  overrides: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user }),
    [`GET /api/employees/${ids.priya}`]: () => Response.json({ employee: priya, payTotals }),
    [`GET /api/employees/${ids.priya}/pay`]: () => Response.json(currentPay),
    [`GET /api/employees/${ids.priya}/pay-changes`]: () => Response.json(payHistory),
    [`GET /api/employees/${ids.priya}/change-log`]: () => Response.json({ items: [] }),
    'GET /api/pay-components': ({ query }) =>
      Response.json({
        items: query.get('country') === 'US' ? components.US : components.IN,
        frequencies,
      }),
    'GET /api/fx-rates/latest': () =>
      Response.json({ rateDate: '2026-09-24', rates, stale: false }),
    ...overrides,
  });
}

/** The text of each cell in a table row, in order. */
function cells(row: HTMLElement) {
  return Array.from(row.children).map((cell) => cell.textContent);
}

function usd(amountMinor: number) {
  return formatMoney(convertMinor(amountMinor, 'INR', 'USD', rates), 'USD');
}

describe('pay on the employee page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the current components with monthly and annual amounts, and the totals', async () => {
    payApi();
    renderApp(`/employees/${ids.priya}`);

    const pay = await screen.findByRole('region', { name: 'Current pay' });
    expect(cells(await within(pay).findByRole('row', { name: /^Basic/ }))).toEqual([
      'Basic',
      '₹50,000.00',
      'Monthly',
      '₹50,000.00',
      '₹600,000.00',
    ]);
    expect(cells(within(pay).getByRole('row', { name: /^Total/ }))).toEqual([
      'Total',
      '₹70,000.00',
      '₹840,000.00',
    ]);
    expect(cells(within(pay).getByRole('row', { name: /^Gross pay/ }))).toEqual([
      'Gross pay',
      '₹70,000.00',
      '₹840,000.00',
    ]);
    const summary = screen.getByRole('region', { name: 'Pay summary' });
    expect(within(summary).getByText('Annual total').nextElementSibling).toHaveTextContent(
      '₹840,000.00',
    );
  });

  it('shows amounts in US dollars with the rate date when the toggle says so', async () => {
    payApi();
    renderApp(`/employees/${ids.priya}?currency=USD`);

    const pay = await screen.findByRole('region', { name: 'Current pay' });
    await within(pay).findAllByText(usd(5_000_000));
    expect(cells(within(pay).getByRole('row', { name: /^Total/ }))).toEqual([
      'Total',
      usd(7_000_000),
      usd(84_000_000),
    ]);
    expect(within(pay).getByText('US dollars at rates of 24 Sep 2026')).toBeInTheDocument();
  });

  it('lists the pay history, newest first, with scheduled changes marked', async () => {
    payApi();
    renderApp(`/employees/${ids.priya}`);

    const history = await screen.findByRole('region', { name: 'Pay history' });
    const entries = await within(history).findAllByRole('listitem', { name: /2026/ });
    expect(entries.map((entry) => entry.getAttribute('aria-label'))).toEqual([
      'Correction from 1 Dec 2026 (scheduled)',
      'Revision from 1 Apr 2026',
    ]);
    const revision = entries[1];
    if (!revision) throw new Error('No entry');
    expect(revision).toHaveTextContent('Basic: ₹45,000.00 monthly to ₹50,000.00 monthly');
    expect(revision).toHaveTextContent('Leave travel allowance: added at ₹40,000.00 yearly');
    expect(revision).toHaveTextContent('Annual review');
    expect(entries[0]).toHaveTextContent('House rent allowance: ended (was ₹20,000.00 monthly)');
  });

  it('records a pay change that changes, ends and adds components', async () => {
    const user = userEvent.setup();
    const { calls } = payApi(globalHrUser, {
      [`POST /api/employees/${ids.priya}/pay-changes`]: () =>
        Response.json({ payChange: payHistory.items[1] }, { status: 201 }),
    });
    renderApp(`/employees/${ids.priya}`);

    await user.click(await screen.findByRole('button', { name: 'Record pay change' }));
    const dialog = screen.getByRole('dialog', { name: 'Record pay change' });
    const date = within(dialog).getByLabelText('Effective from');
    await user.clear(date);
    await user.type(date, '2026-10-01');
    await chooseOption(user, 'Reason', 'Revision');
    await chooseOption(user, 'Basic', 'Change');
    const amount = within(dialog).getByLabelText('New amount for Basic');
    await user.clear(amount);
    await user.type(amount, '55000');
    await chooseOption(user, 'House rent allowance', 'End');
    await user.click(within(dialog).getByRole('button', { name: 'Add component' }));
    const added = within(dialog).getByRole('group', { name: 'New component 1' });
    await chooseOption(user, 'Component', 'Leave travel allowance');
    await user.type(within(added).getByLabelText('Amount'), '40000');
    await user.click(within(dialog).getByRole('button', { name: 'Save pay change' }));

    expect(await screen.findByText('Pay change saved.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      effectiveFrom: '2026-10-01',
      reason: 'revision',
      set: [
        { componentId: ids.basic, amount: '55000', currency: 'INR', frequency: 'monthly' },
        { componentId: ids.lta, amount: '40000', currency: 'INR', frequency: 'yearly' },
      ],
      end: [ids.hra],
    });
  });

  it('asks for at least one change and shows why the API refused one', async () => {
    const user = userEvent.setup();
    const { calls } = payApi(globalHrUser, {
      [`POST /api/employees/${ids.priya}/pay-changes`]: () =>
        problem(400, 'The request has invalid fields', [
          { field: 'end.0', message: 'House rent allowance is not part of current pay' },
        ]),
    });
    renderApp(`/employees/${ids.priya}`);

    await user.click(await screen.findByRole('button', { name: 'Record pay change' }));
    await chooseOption(user, 'Reason', 'Correction');
    await user.click(screen.getByRole('button', { name: 'Save pay change' }));
    expect(
      await screen.findByText('Change, add or end at least one component'),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST')).toEqual([]);

    await chooseOption(user, 'House rent allowance', 'End');
    await user.click(screen.getByRole('button', { name: 'Save pay change' }));
    const dialog = screen.getByRole('dialog', { name: 'Record pay change' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'House rent allowance is not part of current pay',
    );
  });

  it('points out a component set to its current amount and frequency before sending', async () => {
    const user = userEvent.setup();
    const { calls } = payApi(globalHrUser, {
      [`POST /api/employees/${ids.priya}/pay-changes`]: () =>
        Response.json({ payChange: payHistory.items[1] }, { status: 201 }),
    });
    renderApp(`/employees/${ids.priya}`);

    await user.click(await screen.findByRole('button', { name: 'Record pay change' }));
    await chooseOption(user, 'Reason', 'Revision');
    await chooseOption(user, 'Basic', 'Change');
    await user.click(screen.getByRole('button', { name: 'Save pay change' }));

    expect(
      await screen.findByText('Enter a different amount or frequency, or choose Keep'),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST')).toEqual([]);

    await chooseOption(user, 'Frequency for Basic', 'Yearly');
    await user.click(screen.getByRole('button', { name: 'Save pay change' }));
    await screen.findByText('Pay change saved.');
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      set: [{ componentId: ids.basic, amount: '50000.00', frequency: 'yearly' }],
    });
  });

  it('offers pay changes only for active employees', async () => {
    payApi(globalHrUser, {
      [`GET /api/employees/${ids.priya}`]: () =>
        Response.json({
          employee: { ...priya, status: 'inactive', inactiveOn: '2026-09-01' },
          payTotals,
        }),
    });
    renderApp(`/employees/${ids.priya}`);

    await screen.findByRole('region', { name: 'Current pay' });
    expect(screen.queryByRole('button', { name: 'Record pay change' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Move to another country' }),
    ).not.toBeInTheDocument();
  });
});

describe('moving an employee to another country', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is offered to global HR users only', async () => {
    payApi(indiaHrUser);
    renderApp(`/employees/${ids.priya}`);

    await screen.findByRole('button', { name: 'Record pay change' });
    expect(
      screen.queryByRole('button', { name: 'Move to another country' }),
    ).not.toBeInTheDocument();
  });

  it("sets the new country, region and pay in the new country's currency", async () => {
    const user = userEvent.setup();
    const { calls } = payApi(globalHrUser, {
      [`POST /api/employees/${ids.priya}/transfer`]: () =>
        Response.json({
          employee: { ...priya, countryCode: 'US', region: 'Texas', countryFields: {} },
        }),
    });
    renderApp(`/employees/${ids.priya}`);

    await user.click(await screen.findByRole('button', { name: 'Move to another country' }));
    const dialog = screen.getByRole('dialog', { name: 'Move to another country' });
    await chooseOption(user, 'New country', 'United States');
    await chooseOption(user, 'State', 'Texas');
    const date = within(dialog).getByLabelText('Effective from');
    await user.clear(date);
    await user.type(date, '2026-09-20');
    await chooseOption(user, 'Component', 'Base salary or wages');
    const line = within(dialog).getByRole('group', { name: 'New pay component 1' });
    await user.type(within(line).getByLabelText('Amount'), '4000');
    await user.click(within(dialog).getByRole('button', { name: 'Move employee' }));

    expect(await screen.findByText('Priya Nair was moved to United States.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      countryCode: 'US',
      region: 'Texas',
      countryFields: {},
      effectiveFrom: '2026-09-20',
      items: [{ componentId: ids.usBase, amount: '4000', currency: 'USD', frequency: 'bi_weekly' }],
    });
  });
});
