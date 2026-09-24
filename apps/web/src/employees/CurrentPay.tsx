import type { ReactNode } from 'react';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Money } from '../currency/Money.tsx';
import { RateDate } from '../currency/RateDate.tsx';
import { useCurrentPay } from './api.ts';
import { frequencyLabel } from './labels.ts';

/**
 * Today's pay components with their monthly equivalent and annual amount, and the totals.
 * Amounts follow the currency toggle.
 */
export function CurrentPay({ employeeId, action }: { employeeId: string; action?: ReactNode }) {
  const pay = useCurrentPay(employeeId);

  return (
    <section aria-labelledby="current-pay-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="current-pay-heading" className="text-lg font-medium">
          Current pay
        </h2>
        {action}
      </div>
      {pay.isPending && <p className="text-sm text-muted-foreground">Loading pay...</p>}
      {pay.isError && <Alert>{errorMessage(pay.error)}</Alert>}
      {pay.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No current pay. Record a pay change to add components.
        </p>
      )}
      {pay.data && pay.data.items.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Component
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Amount
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Frequency
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Monthly
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Annual
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {pay.data.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      {item.component.name}
                    </th>
                    <td className="py-2 pr-4 text-right">
                      <Money {...item.amount} />
                    </td>
                    <td className="py-2 pr-4">{frequencyLabel(item.frequency)}</td>
                    <td className="py-2 pr-4 text-right">
                      <Money {...item.monthlyAmount} />
                    </td>
                    <td className="py-2 text-right">
                      <Money {...item.annualAmount} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular-nums">
                <tr className="border-t font-medium">
                  <th scope="row" colSpan={3} className="py-2 pr-4 text-left">
                    Total
                  </th>
                  <td className="py-2 pr-4 text-right">
                    <Money {...pay.data.totals.monthlyTotal} />
                  </td>
                  <td className="py-2 text-right">
                    <Money {...pay.data.totals.annualTotal} />
                  </td>
                </tr>
                <tr className="text-muted-foreground">
                  <th scope="row" colSpan={3} className="py-2 pr-4 text-left font-normal">
                    Gross pay
                  </th>
                  <td className="py-2 pr-4 text-right">
                    <Money {...pay.data.totals.monthlyGross} />
                  </td>
                  <td className="py-2 text-right">
                    <Money {...pay.data.totals.annualGross} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Gross pay counts earnings, allowances and bonuses, without employer contributions and
            benefits.
          </p>
          <div className="mt-2">
            <RateDate />
          </div>
        </>
      )}
    </section>
  );
}
