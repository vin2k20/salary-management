import {
  COUNTRIES,
  COUNTRY_CODES,
  CURRENCY_CODES,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  FLSA_STATUSES,
  PAY_CHANGE_REASONS,
  PAY_FREQUENCY_CODES,
  formatMoney,
  type ChangeLogAction,
  type ChangeLogEntry,
} from '@salary/shared';
import { z } from 'zod';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { formatDate } from '../lib/format.ts';
import { useEmployeeChangeLog } from './api.ts';
import {
  EMPLOYMENT_TYPE_LABELS,
  FIELD_LABELS,
  FLSA_STATUS_LABELS,
  PAY_CHANGE_REASON_LABELS,
  STATUS_LABELS,
  frequencyLabel,
} from './labels.ts';

const ACTION_LABELS: Record<ChangeLogAction, string> = {
  created: 'Added',
  updated: 'Updated',
  inactivated: 'Marked inactive',
  transferred: 'Moved to another country',
};

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return values.some((item) => item === value);
}

/** A pay component's amount as the pay change log stores it. */
const loggedAmountSchema = z.object({
  amountMinor: z.number().int(),
  currency: z.enum(CURRENCY_CODES),
  frequency: z.enum(PAY_FREQUENCY_CODES),
});

/** A logged value in words, with codes shown by their labels. */
export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field === 'employmentType' && isOneOf(EMPLOYMENT_TYPES, value)) {
    return EMPLOYMENT_TYPE_LABELS[value];
  }
  if (field === 'status' && isOneOf(EMPLOYEE_STATUSES, value)) return STATUS_LABELS[value];
  if (field === 'flsaStatus' && isOneOf(FLSA_STATUSES, value)) return FLSA_STATUS_LABELS[value];
  if (field === 'countryCode' && isOneOf(COUNTRY_CODES, value)) return COUNTRIES[value].name;
  if (field === 'reason' && isOneOf(PAY_CHANGE_REASONS, value)) {
    return PAY_CHANGE_REASON_LABELS[value];
  }
  const amount = loggedAmountSchema.safeParse(value);
  if (amount.success) {
    const { amountMinor, currency, frequency } = amount.data;
    return `${formatMoney(amountMinor, currency)} ${frequencyLabel(frequency, true)}`;
  }
  if (
    (field === 'hireDate' || field === 'inactiveOn' || field === 'effectiveFrom') &&
    typeof value === 'string'
  ) {
    return formatDate(value);
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function entryLabel(entry: ChangeLogEntry): string {
  const by = entry.changedBy ? ` by ${entry.changedBy.name}` : '';
  const action =
    entry.entityType === 'pay_change' ? 'Pay change recorded' : ACTION_LABELS[entry.action];
  return `${action}${by} on ${formatDate(entry.changedAt)}`;
}

/** An added employee is shown without its field list; a pay change lists what it set. */
function showsChanges(entry: ChangeLogEntry): boolean {
  return !(entry.entityType === 'employee' && entry.action === 'created');
}

/** Who changed what and when, newest first, including pay changes. */
export function EmployeeChangeLog({ employeeId }: { employeeId: string }) {
  const log = useEmployeeChangeLog(employeeId);

  if (log.isPending) return <p className="text-sm text-muted-foreground">Loading changes...</p>;
  if (log.isError) return <Alert>{errorMessage(log.error)}</Alert>;
  if (log.data.items.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-4 text-sm">
      {log.data.items.map((entry) => {
        const label = entryLabel(entry);
        return (
          <li key={entry.id} aria-label={label} className="border-l-2 pl-4">
            <p className="font-medium">{label}</p>
            {showsChanges(entry) && (
              <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                {Object.entries(entry.changes).map(([field, change]) => (
                  <li key={field}>
                    <span className="text-foreground">{FIELD_LABELS[field] ?? field}:</span>{' '}
                    {formatValue(field, change.old)} to {formatValue(field, change.new)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
