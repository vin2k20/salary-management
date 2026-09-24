import type { PayHistoryEntry } from '@salary/shared';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Money } from '../currency/Money.tsx';
import { formatDate } from '../lib/format.ts';
import { usePayHistory } from './api.ts';
import { PAY_CHANGE_REASON_LABELS, frequencyLabel } from './labels.ts';

type Line = PayHistoryEntry['lines'][number];
type PeriodAmount = NonNullable<Line['before']>;

function Amount({ value }: { value: PeriodAmount }) {
  return (
    <>
      <Money {...value.amount} /> {frequencyLabel(value.frequency, true)}
    </>
  );
}

/** One component in a change: changed, added or ended. */
function LineText({ line }: { line: Line }) {
  const { before, after } = line;
  return (
    <li>
      <span className="text-foreground">{line.component.name}:</span>{' '}
      {before && after && (
        <>
          <Amount value={before} /> to <Amount value={after} />
        </>
      )}
      {!before && after && (
        <>
          added at <Amount value={after} />
        </>
      )}
      {before && !after && (
        <>
          ended (was <Amount value={before} />)
        </>
      )}
    </li>
  );
}

function entryLabel(entry: PayHistoryEntry): string {
  const label = `${PAY_CHANGE_REASON_LABELS[entry.reason]} from ${formatDate(entry.effectiveFrom)}`;
  return entry.scheduled ? `${label} (scheduled)` : label;
}

/** Every pay change, newest first. Changes dated after today are marked as scheduled. */
export function PayHistory({ employeeId }: { employeeId: string }) {
  const history = usePayHistory(employeeId);

  return (
    <section aria-labelledby="pay-history-heading">
      <h2 id="pay-history-heading" className="mb-4 text-lg font-medium">
        Pay history
      </h2>
      {history.isPending && <p className="text-sm text-muted-foreground">Loading history...</p>}
      {history.isError && <Alert>{errorMessage(history.error)}</Alert>}
      {history.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No pay changes recorded yet.</p>
      )}
      {history.data && history.data.items.length > 0 && (
        <ol className="flex flex-col gap-4 text-sm">
          {history.data.items.map((entry) => {
            const label = entryLabel(entry);
            return (
              <li key={entry.id} aria-label={label} className="border-l-2 pl-4">
                <p className="font-medium">
                  {PAY_CHANGE_REASON_LABELS[entry.reason]} from {formatDate(entry.effectiveFrom)}
                  {entry.scheduled && (
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      Scheduled
                    </span>
                  )}
                </p>
                {entry.createdBy && (
                  <p className="text-xs text-muted-foreground">
                    Recorded by {entry.createdBy.name} on {formatDate(entry.createdAt)}
                  </p>
                )}
                {entry.note && <p className="mt-1">{entry.note}</p>}
                <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                  {entry.lines.map((line) => (
                    <LineText key={line.component.id} line={line} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
