import { COUNTRIES, COUNTRY_CODES, PAY_MEASURES, type InsightsQuery } from '@salary/shared';
import { useCurrentUser } from '../auth/session.ts';
import { SelectField } from '../components/select-field.tsx';
import { cn } from '../lib/cn.ts';
import { MEASURE_LABELS } from './format.ts';
import type { DashboardKey } from './useDashboardQuery.ts';

/**
 * One row of filters above every section: the country (global HR users only), the measure and
 * the inactive option. Every change goes into the URL. The currency toggle is in the header.
 */
export function DashboardFilters({
  query,
  update,
}: {
  query: InsightsQuery;
  update: (patch: Partial<Record<DashboardKey, string | boolean>>) => void;
}) {
  const { data: user } = useCurrentUser();

  return (
    <div className="flex flex-wrap items-end gap-6">
      {user?.role === 'global_hr' && (
        <div className="w-56">
          <SelectField
            id="dashboard-country"
            label="Country"
            emptyLabel="All countries"
            value={query.country ?? ''}
            onValueChange={(country) => {
              update({ country });
            }}
            options={COUNTRY_CODES.map((code) => ({ value: code, label: COUNTRIES[code].name }))}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span id="dashboard-measure" className="text-sm font-medium">
          Measure
        </span>
        <div
          role="group"
          aria-labelledby="dashboard-measure"
          className="flex h-9 items-center rounded-md border p-0.5 text-sm"
        >
          {PAY_MEASURES.map((measure) => (
            <button
              key={measure}
              type="button"
              aria-pressed={query.measure === measure}
              className={cn(
                'rounded px-2.5 py-1 text-muted-foreground',
                query.measure === measure && 'bg-secondary text-foreground',
              )}
              onClick={() => {
                update({ measure });
              }}
            >
              {MEASURE_LABELS[measure].name}
            </button>
          ))}
        </div>
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={query.includeInactive}
          onChange={(event) => {
            update({ includeInactive: event.target.checked });
          }}
        />
        Include inactive employees
      </label>
    </div>
  );
}
