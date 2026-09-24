import { componentId, insertEmployee, insertPayChange, insertPayItem } from './fixtures.ts';
import { sharedTestDatabase } from './test-app.ts';

export interface IndianWithPay {
  id: string;
  basic: string;
  hra: string;
  lta: string;
}

/**
 * An employee in India, hired on 1 Jan 2025 with Basic of INR 50,000 and HRA of INR 20,000 a
 * month, in the shared test database. Returns the employee ID and the IDs of three components.
 */
export async function insertIndianWithPay(
  overrides: Parameters<typeof insertEmployee>[1] = {},
): Promise<IndianWithPay> {
  const { db } = await sharedTestDatabase();
  const employee = await insertEmployee(db, { hireDate: '2025-01-01', ...overrides });
  const [basic, hra, lta] = await Promise.all([
    componentId(db, 'basic', 'IN'),
    componentId(db, 'hra', 'IN'),
    componentId(db, 'lta', 'IN'),
  ]);
  const hire = await insertPayChange(db, employee.id, '2025-01-01');
  for (const [component, amountMinor] of [
    [basic, 5_000_000],
    [hra, 2_000_000],
  ] as const) {
    await insertPayItem(db, {
      employeeId: employee.id,
      payChangeId: hire,
      componentId: component,
      amountMinor,
      currencyCode: 'INR',
      frequencyCode: 'monthly',
      effectiveFrom: '2025-01-01',
    });
  }
  return { id: employee.id, basic, hra, lta };
}
