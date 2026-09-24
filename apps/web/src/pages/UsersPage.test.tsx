import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';
import { chooseOption } from '../test/select.ts';

interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'global_hr' | 'country_hr';
  countryCode: string | null;
  status: 'active' | 'invited' | 'inactive';
  lastLoginAt: string | null;
  createdAt: string;
}

const me: TestUser = {
  ...globalHrUser,
  status: 'active',
  lastLoginAt: '2026-09-24T09:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};
const priya: TestUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'priya@acme.example.com',
  name: 'Priya Nair',
  role: 'country_hr',
  countryCode: 'IN',
  status: 'active',
  lastLoginAt: null,
  createdAt: '2026-09-02T00:00:00.000Z',
};
const sam: TestUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'sam@acme.example.com',
  name: 'Sam Lee',
  role: 'country_hr',
  countryCode: 'US',
  status: 'invited',
  lastLoginAt: null,
  createdAt: '2026-09-03T00:00:00.000Z',
};

/** An API with a list of users that changes like the real one. */
function usersApi(extra: Parameters<typeof mockApi>[0] = {}) {
  const users = [me, priya, sam];
  const list = () => Response.json({ items: users, page: 1, pageSize: 50, total: users.length });
  const api = mockApi({
    'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
    'GET /api/users': list,
    [`PATCH /api/users/${priya.id}`]: ({ body }) => {
      Object.assign(priya, body, {
        status: (body as { isActive?: boolean }).isActive === false ? 'inactive' : priya.status,
      });
      return Response.json({ user: priya });
    },
    ...extra,
  });
  return api;
}

function row(name: string) {
  // Search the table only (the header also shows the signed-in user's name). The first match is
  // the name cell; a role label can repeat it (Global HR).
  const [cell] = within(screen.getByRole('table')).getAllByText(name);
  if (!cell) throw new Error(`No text ${name}`);
  const tableRow = cell.closest('tr');
  if (!tableRow) throw new Error(`No row for ${name}`);
  return within(tableRow);
}

describe('UsersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(priya, { countryCode: 'IN', status: 'active' });
  });

  it('lists users with their role, country and status', async () => {
    usersApi();
    renderApp('/users');

    expect(await screen.findByText('Priya Nair')).toBeInTheDocument();
    expect(row('Priya Nair').getByText('Country HR')).toBeInTheDocument();
    expect(row('Priya Nair').getByText('India')).toBeInTheDocument();
    expect(row('Priya Nair').getByText('Active')).toBeInTheDocument();
    expect(row('Sam Lee').getByText('Invited')).toBeInTheDocument();
    expect(row('Global HR').getByText('All countries')).toBeInTheDocument();
  });

  it('does not offer actions on the signed-in user', async () => {
    usersApi();
    renderApp('/users');

    await screen.findByText('Priya Nair');
    expect(row('Global HR').queryByRole('button')).not.toBeInTheDocument();
  });

  it('asks for a country for country HR users and none for global HR users', async () => {
    const { calls } = usersApi();
    renderApp('/users');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'New Person');
    await user.type(screen.getByLabelText('Email'), 'new.person@acme.example.com');
    await chooseOption(user, 'Role', 'Country HR (one country)');
    await user.click(screen.getByRole('button', { name: 'Add and send invite' }));

    expect(await screen.findByText('Choose the country this user manages')).toBeInTheDocument();
    await chooseOption(user, 'Role', 'Global HR (all countries)');
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled();
    expect(calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('adds a user, sends the invite and says so', async () => {
    const { calls } = usersApi({
      'POST /api/users': ({ body }) =>
        Response.json(
          {
            user: {
              ...sam,
              id: '33333333-3333-4333-8333-333333333333',
              ...(body as object),
              status: 'invited',
            },
            inviteSent: true,
          },
          { status: 201 },
        ),
    });
    renderApp('/users');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'New Person');
    await user.type(screen.getByLabelText('Email'), 'New.Person@acme.example.com');
    await chooseOption(user, 'Role', 'Country HR (one country)');
    await chooseOption(user, 'Country', 'Australia');
    await user.click(screen.getByRole('button', { name: 'Add and send invite' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'New Person was added and an invite was sent to new.person@acme.example.com.',
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'New Person',
      email: 'new.person@acme.example.com',
      role: 'country_hr',
      countryCode: 'AU',
    });
    expect(
      calls.filter((call) => call.method === 'GET' && call.path === '/api/users').length,
    ).toBeGreaterThan(1);
  });

  it('tells the user when the invite email could not be sent', async () => {
    usersApi({
      'POST /api/users': () => Response.json({ user: sam, inviteSent: false }, { status: 201 }),
    });
    renderApp('/users');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'Sam Lee');
    await user.type(screen.getByLabelText('Email'), 'sam@acme.example.com');
    await chooseOption(user, 'Role', 'Global HR (all countries)');
    await user.click(screen.getByRole('button', { name: 'Add and send invite' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sam Lee was added, but the invite email could not be sent. Use Resend invite to try again.',
    );
  });

  it('shows the message from the API when the email is already used', async () => {
    usersApi({
      'POST /api/users': () => problem(409, 'A user with this email already exists'),
    });
    renderApp('/users');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Name'), 'Priya Again');
    await user.type(screen.getByLabelText('Email'), 'priya@acme.example.com');
    await chooseOption(user, 'Role', 'Global HR (all countries)');
    await user.click(screen.getByRole('button', { name: 'Add and send invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A user with this email already exists',
    );
  });

  it('deactivates a user after confirming', async () => {
    const { calls } = usersApi();
    renderApp('/users');
    const user = userEvent.setup();

    await screen.findByText('Priya Nair');
    await user.click(row('Priya Nair').getByRole('button', { name: 'Deactivate' }));
    expect(calls.filter((call) => call.method === 'PATCH')).toEqual([]);
    await user.click(row('Priya Nair').getByRole('button', { name: 'Confirm deactivate' }));

    expect(await row('Priya Nair').findByText('Inactive')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ isActive: false });
  });

  it('sends a new invite to an invited user', async () => {
    const { calls } = usersApi({
      [`POST /api/users/${sam.id}/invite`]: () => new Response(null, { status: 204 }),
    });
    renderApp('/users');
    const user = userEvent.setup();

    await screen.findByText('Sam Lee');
    expect(
      row('Priya Nair').queryByRole('button', { name: 'Resend invite' }),
    ).not.toBeInTheDocument();
    await user.click(row('Sam Lee').getByRole('button', { name: 'Resend invite' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'A new invite was sent to sam@acme.example.com.',
    );
    expect(calls.some((call) => call.path === `/api/users/${sam.id}/invite`)).toBe(true);
  });

  it('changes the country of a country HR user', async () => {
    const { calls } = usersApi();
    renderApp('/users');
    const user = userEvent.setup();

    await screen.findByText('Priya Nair');
    await user.click(row('Priya Nair').getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Priya Nair');
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('India');
    await chooseOption(user, 'Country', 'Canada');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await row('Priya Nair').findByText('Canada')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      name: 'Priya Nair',
      role: 'country_hr',
      countryCode: 'CA',
    });
  });
});
