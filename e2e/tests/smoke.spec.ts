import { expect, test, type Locator, type Page } from '@playwright/test';
import { fromMinorUnits, toMinorUnits } from '@salary/shared';

const INDIA_HR = 'hr.in@acme.example.com';

/** The raise recorded on the employee's first pay component: 1,000 rupees per period. */
const RAISE_MINOR = 100_000;

/** An amount shown in rupees, such as "₹1,234,567.00", in minor units. */
async function rupees(amount: Locator): Promise<number> {
  const text = await amount.innerText();
  expect(text).toContain('₹');
  return toMinorUnits(text.replace(/[^\d.]/g, ''), 'INR');
}

/** A figure in the dashboard summary, such as the annual cost. */
function summaryFigure(page: Page, label: string): Locator {
  return page
    .locator('dl > div')
    .filter({ has: page.getByRole('term').getByText(label, { exact: true }) })
    .getByRole('definition');
}

test('sign in, search, change pay and view the dashboard in both currencies', async ({ page }) => {
  const password = process.env.E2E_HR_PASSWORD;
  if (!password) throw new Error('E2E_HR_PASSWORD is set by the Playwright config');

  // Signing in as India's HR user opens the dashboard for India, in rupees.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('textbox', { name: 'Email' }).fill(INDIA_HR);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const annualCost = summaryFigure(page, 'Annual cost');
  await expect(annualCost).toContainText('₹');
  const costBefore = await rupees(annualCost);

  // Search the directory for one employee by code and open their page.
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  const rows = page.getByRole('row').filter({ has: page.getByRole('link') });
  await expect(rows).not.toHaveCount(0);
  const nameCell = rows.nth(2).getByRole('cell').first();
  const name = await nameCell.getByRole('link').innerText();
  const code = await nameCell.locator('div').innerText();
  await page.getByRole('searchbox', { name: 'Search' }).fill(code);
  await expect(rows).toHaveCount(1);
  await rows.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);

  // Record a raise on the first pay component.
  const annualTotal = page
    .getByRole('region', { name: 'Pay summary' })
    .getByRole('definition')
    .first();
  await expect(annualTotal).toContainText('₹');
  const totalShown = await annualTotal.innerText();
  const totalBefore = await rupees(annualTotal);
  const history = page.getByRole('region', { name: 'Pay history' });
  await expect(history.getByText(/^Hire from/)).toBeVisible();
  const revisions = history.getByText(/^Revision from/);
  const revisionsBefore = await revisions.count();
  await page.getByRole('button', { name: 'Record pay change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record pay change' });
  await dialog.getByRole('combobox', { name: 'Reason' }).click();
  await page.getByRole('option', { name: 'Revision' }).click();
  const current = dialog.getByRole('group', { name: 'Current components' });
  await current.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Change', exact: true }).click();
  const amount = current.getByRole('textbox', { name: /^New amount for / });
  const raised = toMinorUnits(await amount.inputValue(), 'INR') + RAISE_MINOR;
  await amount.fill(fromMinorUnits(raised, 'INR'));
  await dialog.getByRole('button', { name: 'Save pay change' }).click();
  await expect(dialog).toBeHidden();
  await expect(revisions).toHaveCount(revisionsBefore + 1);
  await expect(annualTotal).not.toHaveText(totalShown);
  const raiseInYear = (await rupees(annualTotal)) - totalBefore;
  expect(raiseInYear).toBeGreaterThan(0);

  // The dashboard's annual cost goes up by the employee's raise over a year.
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(async () => {
    expect((await rupees(annualCost)) - costBefore).toBe(raiseInYear);
  }).toPass({ timeout: 10_000 });

  // Switching to US dollars converts every amount at the latest rates.
  await page
    .getByRole('group', { name: 'Show amounts in' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page).toHaveURL(/currency=USD/);
  await expect(annualCost).toContainText('$');
  await expect(annualCost).not.toContainText('₹');
  await expect(page.getByText(/^US dollars at rates of/).first()).toBeVisible();
});
