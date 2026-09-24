import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, indiaHrUser, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { chooseOption } from '../test/select.ts';

const newId = '55555555-5555-4555-8555-555555555555';

const priya = {
  id: '66666666-6666-4666-8666-666666666666',
  employeeCode: 'IN00042',
  firstName: 'Priya',
  lastName: 'Nair',
  email: 'priya.nair@acme.example.com',
  jobTitle: 'Data Analyst',
  jobLevel: 'L2',
  department: 'Data',
  countryCode: 'IN',
  region: 'Kerala',
  employmentType: 'full_time',
  fte: 1,
  hireDate: '2025-01-06',
  status: 'active',
  inactiveOn: null,
  countryFields: { pfApplicable: true, esiApplicable: false },
};

function formApi(
  user: typeof globalHrUser | typeof indiaHrUser = globalHrUser,
  overrides: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user }),
    'GET /api/reference': () =>
      Response.json({
        countries: [],
        regions: [],
        departments: ['Data', 'Engineering'],
        jobTitles: ['Data Analyst', 'Senior Software Engineer', 'Software Engineer'],
        employmentTypes: [],
      }),
    'POST /api/employees': ({ body }) =>
      Response.json(
        { employee: { ...(body as object), id: newId, status: 'active', inactiveOn: null } },
        { status: 201 },
      ),
    [`GET /api/employees/${newId}`]: () =>
      Response.json({ employee: { ...priya, id: newId, firstName: 'Maria', lastName: 'Lopez' } }),
    [`GET /api/employees/${newId}/change-log`]: () => Response.json({ items: [] }),
    [`GET /api/employees/${priya.id}`]: () => Response.json({ employee: priya }),
    [`GET /api/employees/${priya.id}/change-log`]: () => Response.json({ items: [] }),
    ...overrides,
  });
}

async function fillCommonFields(user: UserEvent) {
  await user.type(screen.getByLabelText('Employee code'), 'us00099');
  await user.type(screen.getByLabelText('First name'), 'Maria');
  await user.type(screen.getByLabelText('Last name'), 'Lopez');
  await user.type(screen.getByLabelText('Work email'), 'maria.lopez@acme.example.com');
  await user.type(screen.getByLabelText('Job title'), 'Software Engineer');
  await user.type(screen.getByLabelText('Department'), 'Engineering');
  await chooseOption(user, 'Employment type', 'Part-time');
  await user.clear(screen.getByLabelText('FTE'));
  await user.type(screen.getByLabelText('FTE'), '0.5');
  await user.type(screen.getByLabelText('Hire date'), '2026-10-01');
}

describe('adding an employee', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is opened from the directory', async () => {
    const user = userEvent.setup();
    formApi(globalHrUser, {
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
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
          currency: 'local',
          rateDate: null,
        }),
    });
    renderApp('/employees');

    await user.click(await screen.findByRole('link', { name: 'Add employee' }));

    expect(await screen.findByRole('heading', { name: 'Add an employee' })).toBeInTheDocument();
  });

  it("asks for the chosen country's region and fields, and saves the employee", async () => {
    const user = userEvent.setup();
    const { calls } = formApi();
    const { router } = renderApp('/employees/new');

    await screen.findByRole('heading', { name: 'Add an employee' });
    await fillCommonFields(user);
    await chooseOption(user, 'Country', 'United States');
    await chooseOption(user, 'State', 'Texas');
    await chooseOption(user, 'FLSA status', 'Non-exempt');
    await user.click(screen.getByRole('button', { name: 'Add employee' }));

    await screen.findByRole('heading', { name: 'Maria Lopez' });
    expect(router.state.location.pathname).toBe(`/employees/${newId}`);
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      employeeCode: 'US00099',
      firstName: 'Maria',
      lastName: 'Lopez',
      email: 'maria.lopez@acme.example.com',
      jobTitle: 'Software Engineer',
      jobLevel: null,
      department: 'Engineering',
      countryCode: 'US',
      region: 'Texas',
      employmentType: 'part_time',
      fte: 0.5,
      hireDate: '2026-10-01',
      countryFields: { flsaStatus: 'non_exempt' },
    });
  });

  it('shows the fields of each country', async () => {
    const user = userEvent.setup();
    formApi();
    renderApp('/employees/new');
    await screen.findByRole('heading', { name: 'Add an employee' });

    await chooseOption(user, 'Country', 'India');
    expect(screen.getByRole('checkbox', { name: 'PF applies' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ESI applies' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'State or union territory' })).toBeInTheDocument();

    await chooseOption(user, 'Country', 'Australia');
    expect(screen.getByLabelText('Award or agreement')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'PF applies' })).not.toBeInTheDocument();

    await chooseOption(user, 'Country', 'Canada');
    expect(screen.getByRole('combobox', { name: 'Province or territory' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Award or agreement')).not.toBeInTheDocument();
  });

  it('suggests job titles and departments already in use, and still takes new ones', async () => {
    const user = userEvent.setup();
    formApi();
    renderApp('/employees/new');
    await screen.findByRole('heading', { name: 'Add an employee' });

    const title = screen.getByRole('combobox', { name: 'Job title' });
    await user.type(title, 'soft');
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Senior Software Engineer',
      'Software Engineer',
    ]);
    await user.click(screen.getByRole('option', { name: 'Software Engineer' }));
    expect(title).toHaveValue('Software Engineer');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    const department = screen.getByRole('combobox', { name: 'Department' });
    await user.type(department, 'eng');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(department).toHaveValue('Engineering');

    await user.clear(department);
    await user.type(department, 'Platform');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(department).toHaveValue('Platform');
  });

  it('explains what is missing before sending anything', async () => {
    const user = userEvent.setup();
    const { calls } = formApi();
    renderApp('/employees/new');
    await screen.findByRole('heading', { name: 'Add an employee' });

    await user.click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText('Enter an employee code')).toBeInTheDocument();
    expect(screen.getByText('Enter a first name')).toBeInTheDocument();
    expect(screen.getByText('Choose a country')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it("keeps a country HR user's employees in their own country", async () => {
    const user = userEvent.setup();
    const { calls } = formApi(indiaHrUser);
    renderApp('/employees/new');
    await screen.findByRole('heading', { name: 'Add an employee' });

    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled();
    await fillCommonFields(user);
    await chooseOption(user, 'State or union territory', 'Kerala');
    await user.click(screen.getByRole('checkbox', { name: 'PF applies' }));
    await user.click(screen.getByRole('button', { name: 'Add employee' }));

    await screen.findByRole('heading', { name: 'Maria Lopez' });
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      countryCode: 'IN',
      region: 'Kerala',
      countryFields: { pfApplicable: true, esiApplicable: false },
    });
  });

  it('shows why the API refused the employee', async () => {
    const user = userEvent.setup();
    formApi(indiaHrUser, {
      'POST /api/employees': () => problem(409, 'An employee with the code US00099 already exists'),
    });
    renderApp('/employees/new');
    await screen.findByRole('heading', { name: 'Add an employee' });

    await fillCommonFields(user);
    await chooseOption(user, 'State or union territory', 'Kerala');
    await user.click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An employee with the code US00099 already exists',
    );
  });
});

describe('editing an employee', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('changes the details but not the employee code or country', async () => {
    const user = userEvent.setup();
    const { calls } = formApi(globalHrUser, {
      [`PATCH /api/employees/${priya.id}`]: ({ body }) =>
        Response.json({ employee: { ...priya, ...(body as object) } }),
    });
    const { router } = renderApp(`/employees/${priya.id}/edit`);

    expect(await screen.findByRole('heading', { name: 'Edit Priya Nair' })).toBeInTheDocument();
    expect(screen.getByLabelText('Employee code')).toHaveAttribute('readonly');
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'PF applies' })).toBeChecked();

    const title = screen.getByLabelText('Job title');
    await user.clear(title);
    await user.type(title, 'Senior Data Analyst');
    await user.click(screen.getByRole('checkbox', { name: 'ESI applies' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { name: 'Priya Nair' });
    expect(router.state.location.pathname).toBe(`/employees/${priya.id}`);
    const body = calls.find((call) => call.method === 'PATCH')?.body;
    expect(body).toMatchObject({
      jobTitle: 'Senior Data Analyst',
      region: 'Kerala',
      countryFields: { pfApplicable: true, esiApplicable: true },
    });
    expect(body).not.toHaveProperty('employeeCode');
    expect(body).not.toHaveProperty('countryCode');
  });

  it('goes back to the employee without saving on cancel', async () => {
    const user = userEvent.setup();
    const { calls } = formApi();
    const { router } = renderApp(`/employees/${priya.id}/edit`);

    await user.click(await screen.findByRole('link', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe(`/employees/${priya.id}`);
    expect(calls.filter((call) => call.method === 'PATCH')).toEqual([]);
  });
});
