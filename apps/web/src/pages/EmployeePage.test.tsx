import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

const maria = {
  id: '22222222-2222-4222-8222-222222222222',
  employeeCode: 'US00007',
  firstName: 'Maria',
  lastName: 'Lopez',
  email: 'maria.lopez@acme.example.com',
  jobTitle: 'Senior Software Engineer',
  jobLevel: 'L4',
  department: 'Engineering',
  countryCode: 'US',
  region: 'Texas',
  employmentType: 'full_time',
  fte: 1,
  hireDate: '2024-04-01',
  status: 'active',
  inactiveOn: null,
  countryFields: { flsaStatus: 'exempt' },
};

const changeLog = {
  items: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      action: 'updated',
      changes: {
        jobTitle: { old: 'Software Engineer', new: 'Senior Software Engineer' },
        flsaStatus: { old: 'non_exempt', new: 'exempt' },
        jobLevel: { old: null, new: 'L4' },
      },
      changedAt: '2026-09-20T09:30:00.000Z',
      changedBy: { id: globalHrUser.id, name: 'Global HR' },
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      action: 'created',
      changes: { firstName: { old: null, new: 'Maria' } },
      changedAt: '2024-04-01T08:00:00.000Z',
      changedBy: null,
    },
  ],
};

function employeeApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
    [`GET /api/employees/${maria.id}`]: () => Response.json({ employee: maria }),
    [`GET /api/employees/${maria.id}/change-log`]: () => Response.json(changeLog),
    ...overrides,
  });
}

function definition(term: string) {
  const details = screen.getByRole('region', { name: 'Details' });
  const termElement = within(details).getByText(term, { selector: 'dt' });
  return termElement.nextElementSibling?.textContent;
}

describe('EmployeePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the employee's details with their country's own fields", async () => {
    employeeApi();
    renderApp(`/employees/${maria.id}`);

    expect(await screen.findByRole('heading', { name: 'Maria Lopez' })).toBeInTheDocument();
    expect(definition('Employee code')).toBe('US00007');
    expect(definition('Work email')).toBe('maria.lopez@acme.example.com');
    expect(definition('Country')).toBe('United States');
    expect(definition('State')).toBe('Texas');
    expect(definition('Employment type')).toBe('Full-time');
    expect(definition('FTE')).toBe('1');
    expect(definition('Hire date')).toBe('1 Apr 2024');
    expect(definition('Status')).toBe('Active');
    expect(definition('FLSA status')).toBe('Exempt');
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/employees/${maria.id}/edit`,
    );
  });

  it('lists the changes, newest first, with old and new values', async () => {
    employeeApi();
    renderApp(`/employees/${maria.id}`);

    const log = await screen.findByRole('region', { name: 'Change log' });
    const entries = await within(log).findAllByRole('listitem', { name: /on/ });
    expect(entries.map((entry) => entry.getAttribute('aria-label'))).toEqual([
      'Updated by Global HR on 20 Sep 2026',
      'Added on 1 Apr 2024',
    ]);
    const first = entries[0];
    if (!first) throw new Error('No entry');
    expect(within(first).getByText('Job title:').parentElement).toHaveTextContent(
      'Job title: Software Engineer to Senior Software Engineer',
    );
    expect(within(first).getByText('FLSA status:').parentElement).toHaveTextContent(
      'FLSA status: Non-exempt to Exempt',
    );
    expect(within(first).getByText('Job level:').parentElement).toHaveTextContent(
      'Job level: Not set to L4',
    );
  });

  it('marks the employee inactive only after confirming the date', async () => {
    const user = userEvent.setup();
    const { calls } = employeeApi({
      [`PATCH /api/employees/${maria.id}`]: () =>
        Response.json({ employee: { ...maria, status: 'inactive', inactiveOn: '2026-09-20' } }),
    });
    renderApp(`/employees/${maria.id}`);

    await user.click(await screen.findByRole('button', { name: 'Mark inactive' }));
    const confirm = screen.getByRole('region', { name: 'Mark inactive' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(calls.filter((call) => call.method === 'PATCH')).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Mark inactive' }));
    const date = screen.getByLabelText('Inactive from');
    await user.clear(date);
    await user.type(date, '2026-09-20');
    await user.click(screen.getByRole('button', { name: 'Confirm mark inactive' }));

    expect(await screen.findByText('Maria Lopez was marked inactive.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      status: 'inactive',
      inactiveOn: '2026-09-20',
    });
    expect(definition('Status')).toBe('Inactive from 20 Sep 2026');
    expect(screen.getByRole('button', { name: 'Mark active' })).toBeInTheDocument();
  });

  it('shows the reason when the change is refused', async () => {
    const user = userEvent.setup();
    employeeApi({
      [`PATCH /api/employees/${maria.id}`]: () =>
        problem(400, 'The inactive date cannot be in the future'),
    });
    renderApp(`/employees/${maria.id}`);

    await user.click(await screen.findByRole('button', { name: 'Mark inactive' }));
    await user.click(screen.getByRole('button', { name: 'Confirm mark inactive' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The inactive date cannot be in the future',
    );
  });

  it('says so when the employee does not exist or is outside the user scope', async () => {
    employeeApi({
      [`GET /api/employees/${maria.id}`]: () => problem(404, 'Employee not found'),
    });
    renderApp(`/employees/${maria.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Employee not found');
  });

  it('is opened from the directory', async () => {
    const user = userEvent.setup();
    employeeApi({
      'GET /api/reference': () =>
        Response.json({
          countries: [],
          regions: [],
          departments: [],
          jobTitles: [],
          employmentTypes: [],
        }),
      'GET /api/employees': () =>
        Response.json({
          items: [
            {
              ...maria,
              annualTotal: { amountMinor: 0, currency: 'USD' },
              monthlyTotal: { amountMinor: 0, currency: 'USD' },
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
          currency: 'local',
          rateDate: null,
        }),
    });
    renderApp('/employees');

    await user.click(await screen.findByRole('link', { name: 'Maria Lopez' }));

    expect(await screen.findByRole('heading', { name: 'Maria Lopez' })).toBeInTheDocument();
  });
});
