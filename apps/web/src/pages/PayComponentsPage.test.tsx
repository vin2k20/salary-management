import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, indiaHrUser, mockApi, problem } from '../test/mock-api.ts';
import { frequencies } from '../test/pay-data.ts';
import { expectNoAccessibilityProblems } from '../test/axe.ts';
import { renderApp } from '../test/render-app.tsx';
import { chooseOption } from '../test/select.ts';

const stipend = {
  id: 'e0000000-0000-4000-8000-000000000001',
  code: 'stipend',
  name: 'Stipend',
  category: 'earning',
  countryCode: null,
  defaultFrequency: 'monthly',
  isActive: true,
};

const basic = {
  id: 'e0000000-0000-4000-8000-000000000002',
  code: 'basic',
  name: 'Basic',
  category: 'earning',
  countryCode: 'IN',
  defaultFrequency: 'monthly',
  isActive: true,
};

const oldAllowance = {
  id: 'e0000000-0000-4000-8000-000000000003',
  code: 'old_allowance',
  name: 'Old allowance',
  category: 'allowance',
  countryCode: 'IN',
  defaultFrequency: 'yearly',
  isActive: false,
};

function componentsApi(
  user: typeof globalHrUser | typeof indiaHrUser = globalHrUser,
  overrides: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user }),
    'GET /api/pay-components': () =>
      Response.json({ items: [stipend, basic, oldAllowance], frequencies }),
    ...overrides,
  });
}

/** The text of each cell in a table row, in order. */
function cells(row: HTMLElement) {
  return Array.from(row.children).map((cell) => cell.textContent);
}

async function row(name: RegExp) {
  return screen.findByRole('row', { name });
}

describe('PayComponentsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is in the navigation and lists the catalogue with category, country and status', async () => {
    componentsApi(indiaHrUser);
    renderApp('/pay-components');

    expect(await screen.findByRole('heading', { name: 'Pay components' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay components' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(cells(await row(/^Stipend/)).slice(0, 5)).toEqual([
      'Stipendstipend',
      'Earning',
      'All countries',
      'Monthly',
      'Active',
    ]);
    expect(cells(await row(/^Old allowance/)).slice(0, 5)).toEqual([
      'Old allowanceold_allowance',
      'Allowance',
      'India',
      'Yearly',
      'Inactive',
    ]);
  });

  it('adds a component for all countries, with the code suggested from the name', async () => {
    const user = userEvent.setup();
    const { calls } = componentsApi(globalHrUser, {
      'POST /api/pay-components': ({ body }) =>
        Response.json(
          {
            component: {
              ...(body as object),
              id: 'e0000000-0000-4000-8000-000000000009',
              isActive: true,
            },
          },
          { status: 201 },
        ),
    });
    renderApp('/pay-components');

    await user.click(await screen.findByRole('button', { name: 'Add component' }));
    await user.type(screen.getByLabelText('Name'), 'Meal card');
    expect(screen.getByLabelText('Code')).toHaveValue('meal_card');
    await chooseOption(user, 'Category', 'Allowance');
    await chooseOption(user, 'Country', 'All countries');
    await chooseOption(user, 'Usual frequency', 'Monthly');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Meal card was added.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      code: 'meal_card',
      name: 'Meal card',
      category: 'allowance',
      countryCode: null,
      defaultFrequency: 'monthly',
    });
  });

  it('keeps a code the user typed, and shows why the API refused the component', async () => {
    const user = userEvent.setup();
    componentsApi(globalHrUser, {
      'POST /api/pay-components': () =>
        problem(409, 'A component with the code basic already exists for India'),
    });
    renderApp('/pay-components');

    await user.click(await screen.findByRole('button', { name: 'Add component' }));
    await user.type(screen.getByLabelText('Code'), 'basic');
    await user.type(screen.getByLabelText('Name'), 'Basic pay');
    expect(screen.getByLabelText('Code')).toHaveValue('basic');
    await chooseOption(user, 'Category', 'Earning');
    await chooseOption(user, 'Country', 'India');
    await chooseOption(user, 'Usual frequency', 'Monthly');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A component with the code basic already exists for India',
    );
  });

  it("limits country HR users to their own country's components", async () => {
    const user = userEvent.setup();
    componentsApi(indiaHrUser);
    renderApp('/pay-components');

    expect(within(await row(/^Stipend/)).queryByRole('button')).not.toBeInTheDocument();
    expect(within(await row(/^Basic/)).getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('India');
  });

  it('renames a component', async () => {
    const user = userEvent.setup();
    const { calls } = componentsApi(globalHrUser, {
      [`PATCH /api/pay-components/${basic.id}`]: () =>
        Response.json({ component: { ...basic, name: 'Basic salary' } }),
    });
    renderApp('/pay-components');

    await user.click(within(await row(/^Basic/)).getByRole('button', { name: 'Rename' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('Basic');
    await user.clear(name);
    await user.type(name, 'Basic salary');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Basic was renamed to Basic salary.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ name: 'Basic salary' });
  });

  it('deactivates a component only after confirming, and reactivates one', async () => {
    const user = userEvent.setup();
    const { calls } = componentsApi(globalHrUser, {
      [`PATCH /api/pay-components/${basic.id}`]: () =>
        Response.json({ component: { ...basic, isActive: false } }),
      [`PATCH /api/pay-components/${oldAllowance.id}`]: () =>
        Response.json({ component: { ...oldAllowance, isActive: true } }),
    });
    renderApp('/pay-components');

    await user.click(within(await row(/^Basic/)).getByRole('button', { name: 'Deactivate' }));
    expect(calls.filter((call) => call.method === 'PATCH')).toEqual([]);
    await user.click(
      within(await row(/^Basic/)).getByRole('button', { name: 'Confirm deactivate' }),
    );
    expect(
      await screen.findByText(
        'Basic was deactivated. It stays on current pay but cannot be used in new pay changes.',
      ),
    ).toBeInTheDocument();

    await user.click(
      within(await row(/^Old allowance/)).getByRole('button', { name: 'Reactivate' }),
    );
    expect(await screen.findByText('Old allowance can be used again.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PATCH').map((call) => call.body)).toEqual([
      { isActive: false },
      { isActive: true },
    ]);
  });
});

describe('PayComponentsPage accessibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no accessibility problems, with the add form open', async () => {
    const user = userEvent.setup();
    componentsApi();
    renderApp('/pay-components');
    await row(/^Stipend/);
    await expectNoAccessibilityProblems();

    await user.click(screen.getByRole('button', { name: 'Add component' }));
    await expectNoAccessibilityProblems();
  });
});
