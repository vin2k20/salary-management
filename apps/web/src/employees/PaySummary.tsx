import type { PayTotalsResponse } from '@salary/shared';
import { Money } from '../currency/Money.tsx';

/** Today's annual total and monthly equivalent, shown under the employee's name. */
export function PaySummary({ totals }: { totals: PayTotalsResponse }) {
  return (
    <section aria-label="Pay summary">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Annual total</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Money {...totals.annualTotal} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Monthly total</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Money {...totals.monthlyTotal} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
