import {
  COUNTRIES,
  OUTLIER_DIRECTIONS,
  formatMoney,
  type InsightsQuery,
  type OutlierDirection,
} from '@salary/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { SelectField } from '../components/select-field.tsx';
import { Button } from '../components/ui/button.tsx';
import { formatRateDate } from '../currency/rates.ts';
import { EMPLOYMENT_TYPE_LABELS } from '../employees/labels.ts';
import { useOutliers } from './api.ts';
import { DashboardSection } from './DashboardSection.tsx';
import { formatCount, formatDifference } from './format.ts';
import { StatTable } from './StatTable.tsx';

const DIRECTION_LABELS: Record<OutlierDirection, string> = {
  above: 'Paid above peers',
  below: 'Paid below peers',
};

/**
 * Employees paid more than 20% above or below the median of their peers (D32), largest
 * difference first, a page at a time. The page remounts this section when its filters change,
 * so it starts again from the first page.
 */
export function OutliersSection({
  query,
  showCountry,
}: {
  query: InsightsQuery;
  showCountry: boolean;
}) {
  const [direction, setDirection] = useState<OutlierDirection | undefined>(undefined);
  const [page, setPage] = useState(1);
  const outliers = useOutliers(query, { direction, page });
  const data = outliers.data;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const first = data?.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const limit = data?.limitPercent ?? 20;
  const minimum = data?.minimumGroupSize ?? 5;

  return (
    <DashboardSection
      id="outliers"
      title="Pay compared with peers"
      description={`Employees paid more than ${String(limit)}% above or below the median pay of their peers: people with the same country, job title and employment type, in groups of at least ${String(minimum)}.`}
      status={outliers}
      actions={
        <div className="w-48">
          <SelectField
            id="outliers-direction"
            label="Show"
            emptyLabel="All"
            value={direction ?? ''}
            onValueChange={(value) => {
              setDirection(OUTLIER_DIRECTIONS.find((option) => option === value));
              setPage(1);
            }}
            options={OUTLIER_DIRECTIONS.map((option) => ({
              value: option,
              label: DIRECTION_LABELS[option],
            }))}
          />
        </div>
      }
    >
      {data?.total === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No one is paid that far from their peers in this view.
        </p>
      )}
      {data && data.total > 0 && (
        <>
          {data.rateDate && (
            <p className="mt-2 text-sm text-muted-foreground">
              US dollars at rates of {formatRateDate(data.rateDate)}
            </p>
          )}
          <StatTable
            label="Pay compared with peers"
            className="mt-4"
            columns={[
              { header: 'Employee' },
              ...(showCountry ? [{ header: 'Country' }] : []),
              { header: 'Job title' },
              { header: 'Employment type' },
              { header: 'Annual pay', numeric: true },
              { header: 'Peer median', numeric: true },
              { header: 'Difference', numeric: true },
              { header: 'Peers', numeric: true },
            ]}
            rows={data.items.map((item) => ({
              key: item.id,
              cells: [
                <>
                  <Link to={`/employees/${item.id}`} className="font-medium hover:underline">
                    {item.firstName} {item.lastName}
                  </Link>
                  <div className="text-muted-foreground">{item.employeeCode}</div>
                </>,
                ...(showCountry ? [COUNTRIES[item.countryCode].name] : []),
                item.jobTitle,
                EMPLOYMENT_TYPE_LABELS[item.employmentType],
                formatMoney(item.annualPay.amountMinor, item.annualPay.currency),
                formatMoney(item.peerMedian.amountMinor, item.peerMedian.currency),
                formatDifference(item.differencePercent, item.direction),
                formatCount(item.peerCount),
              ],
            }))}
          />
          <nav
            aria-label="Outlier pages"
            className="mt-4 flex items-center justify-between text-sm"
          >
            <p>
              Showing {formatCount(first)} to {formatCount(last)} of {formatCount(data.total)}
            </p>
            <div className="flex items-center gap-2">
              <span>
                Page {formatCount(page)} of {formatCount(lastPage)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => {
                  setPage(page - 1);
                }}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Next page"
                disabled={page >= lastPage}
                onClick={() => {
                  setPage(page + 1);
                }}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}
    </DashboardSection>
  );
}
