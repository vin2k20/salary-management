import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indiaHrUser, mockApi, problem } from '../test/mock-api.ts';
import { expectNoAccessibilityProblems } from '../test/axe.ts';
import { renderApp } from '../test/render-app.tsx';

const summary = {
  valid: true,
  employees: { added: 1, updated: 1, unchanged: 8 },
  pay: { changed: 1, unchanged: 40 },
  changes: [
    {
      sheet: 'Employees',
      row: 2,
      employeeCode: 'IN-9',
      action: 'add',
      details: 'Priya Patel, Data Analyst',
    },
    { sheet: 'Employees', row: 3, employeeCode: 'IN-1', action: 'update', details: 'Department' },
    {
      sheet: 'Pay components',
      row: 5,
      employeeCode: 'IN-1',
      action: 'pay',
      details: 'Basic from 2026-10-01',
    },
  ],
  errors: [],
  errorCount: 0,
};

const invalid = {
  valid: false,
  employees: { added: 0, updated: 0, unchanged: 0 },
  pay: { changed: 0, unchanged: 0 },
  changes: [],
  errors: [
    { sheet: 'Employees', row: 4, column: 'Hire date', message: 'Enter a valid date' },
    { sheet: 'File', row: null, column: null, message: 'Add the Currency column' },
  ],
  errorCount: 620,
};

function importApi(validate: object, commit = () => Response.json(summary)) {
  return mockApi({
    'GET /api/auth/me': () => Response.json({ user: indiaHrUser }),
    'POST /api/imports/validate': () => Response.json(validate),
    'POST /api/imports/commit': commit,
  });
}

const file = () =>
  new File(['Employee code,First name\r\n'], 'employees.csv', { type: 'text/csv' });

/** The text of each cell in a table row, in order. */
function cells(row: HTMLElement) {
  return Array.from(row.children).map((cell) => cell.textContent);
}

async function chooseAndCheck(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(await screen.findByLabelText('File'), file());
  await user.click(screen.getByRole('button', { name: 'Check file' }));
}

describe('ImportPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is in the navigation and offers empty templates', async () => {
    importApi(summary);
    renderApp('/import');

    expect(await screen.findByRole('heading', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Excel template' })).toHaveAttribute(
      'href',
      '/api/imports/template?format=xlsx',
    );
    expect(screen.getByRole('link', { name: 'CSV template: pay components' })).toHaveAttribute(
      'href',
      '/api/imports/template?format=csv&dataset=pay',
    );
    expect(screen.getByRole('button', { name: 'Check file' })).toBeDisabled();
  });

  it('checks the chosen file and lists every problem by row and column', async () => {
    const user = userEvent.setup();
    const { calls } = importApi(invalid);
    renderApp('/import');

    await chooseAndCheck(user);

    expect(
      await screen.findByText(
        'The file has 620 problems. Nothing was saved; fix them and check the file again.',
      ),
    ).toBeInTheDocument();
    const problems = screen.getByRole('table', { name: 'Problems' });
    expect(cells(within(problems).getByRole('row', { name: /Hire date/ }))).toEqual([
      'Employees',
      '4',
      'Hire date',
      'Enter a valid date',
    ]);
    expect(cells(within(problems).getByRole('row', { name: /Currency/ }))).toEqual([
      'File',
      '',
      '',
      'Add the Currency column',
    ]);
    expect(screen.getByText('Showing the first 2 of 620 problems.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/ })).not.toBeInTheDocument();

    const upload = calls.find((call) => call.path === '/api/imports/validate');
    expect(upload?.headers.get('X-Requested-With')).toBe('fetch');
    expect(upload?.body).toBeInstanceOf(FormData);
    expect((upload?.body as FormData).get('file')).toMatchObject({ name: 'employees.csv' });
  });

  it('previews the changes, imports them and shows the result', async () => {
    const user = userEvent.setup();
    const { calls } = importApi(summary);
    renderApp('/import');

    await chooseAndCheck(user);

    expect(
      await screen.findByText('1 employee to add, 1 to update and 1 pay change.'),
    ).toBeInTheDocument();
    const changes = screen.getByRole('table', { name: 'Changes' });
    expect(cells(within(changes).getByRole('row', { name: /Priya/ }))).toEqual([
      'Employees',
      '2',
      'IN-9',
      'Add',
      'Priya Patel, Data Analyst',
    ]);

    await user.click(screen.getByRole('button', { name: 'Import 3 changes' }));

    expect(
      await screen.findByText('Imported: 1 employee added, 1 updated and 1 pay change.'),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.path === '/api/imports/commit')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Go to employees' })).toHaveAttribute(
      'href',
      '/employees',
    );
  });

  it('says so when a file changes nothing', async () => {
    const user = userEvent.setup();
    importApi({
      ...summary,
      employees: { added: 0, updated: 0, unchanged: 10 },
      pay: { changed: 0, unchanged: 40 },
      changes: [],
    });
    renderApp('/import');

    await chooseAndCheck(user);

    expect(
      await screen.findByText('Nothing to import: every row matches what is stored.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import/ })).not.toBeInTheDocument();
  });

  it('shows why an import was refused, and saves nothing', async () => {
    const user = userEvent.setup();
    importApi(summary, () =>
      problem(422, 'The file has 1 problem. Check it again to see the list.'),
    );
    renderApp('/import');

    await chooseAndCheck(user);
    await user.click(await screen.findByRole('button', { name: 'Import 3 changes' }));

    expect(
      await screen.findByText('The file has 1 problem. Check it again to see the list.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/^Imported:/)).not.toBeInTheDocument();
    });
  });

  it('starts again when another file is chosen', async () => {
    const user = userEvent.setup();
    importApi(summary);
    renderApp('/import');

    await chooseAndCheck(user);
    await screen.findByRole('table', { name: 'Changes' });
    await user.upload(screen.getByLabelText('File'), file());

    expect(screen.queryByRole('table', { name: 'Changes' })).not.toBeInTheDocument();
  });
});

describe('ImportPage accessibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no accessibility problems with problems or changes shown', async () => {
    const user = userEvent.setup();
    importApi(invalid);
    renderApp('/import');
    await chooseAndCheck(user);
    await screen.findByRole('table', { name: 'Problems' });
    await expectNoAccessibilityProblems();

    vi.unstubAllGlobals();
    importApi(summary);
    await user.click(screen.getByRole('button', { name: 'Check file' }));
    await screen.findByRole('table', { name: 'Changes' });
    await expectNoAccessibilityProblems();
  });
});
