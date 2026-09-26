import { COUNTRIES, formatMoney, type InsightsSummary, type Money } from '@salary/shared';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { formatRateDate } from '../currency/rates.ts';
import { DashboardSection, type SectionStatus } from './DashboardSection.tsx';
import { MEASURE_LABELS, formatCount } from './format.ts';
import { StatTable } from './StatTable.tsx';

const money = (amount: Money) => formatMoney(amount.amountMinor, amount.currency);

/** Headcount with annual and monthly cost, as three figures above everything else. */
export function SummaryFigures({
  data,
  status,
}: {
  data: InsightsSummary | undefined;
  status: SectionStatus;
}) {
  if (status.isError) return <Alert className="mt-6">{errorMessage(status.error)}</Alert>;
  if (!data) return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  const labels = MEASURE_LABELS[data.measure];
  const figures = [
    { label: 'Employees', value: formatCount(data.headcount) },
    { label: labels.annual, value: money(data.annualCost) },
    { label: labels.monthly, value: money(data.monthlyCost) },
  ];

  let rateNote: string | null = null;
  if (data.rateDate && data.countryCode === null) {
    rateNote = `Organisation totals are in US dollars at rates of ${formatRateDate(data.rateDate)}.`;
  } else if (data.rateDate) {
    rateNote = `US dollars at rates of ${formatRateDate(data.rateDate)}.`;
  }
  const withoutPay =
    data.withoutPay === 1
      ? '1 employee has no current pay and is left out of pay figures.'
      : `${formatCount(data.withoutPay)} employees have no current pay and are left out of pay figures.`;

  return (
    <div className={status.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-lg border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{figure.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        {rateNote && <p>{rateNote}</p>}
        {data.withoutPay > 0 && <p>{withoutPay}</p>}
      </div>
    </div>
  );
}

/** Each country's headcount and cost, on the all-countries view (in the toggle's currency). */
export function CountryCostSection({
  data,
  status,
}: {
  data: InsightsSummary;
  status: SectionStatus;
}) {
  const labels = MEASURE_LABELS[data.measure];
  return (
    <DashboardSection id="cost-by-country" title="Cost by country" status={status}>
      <StatTable
        label="Cost by country"
        className="mt-4"
        columns={[
          { header: 'Country' },
          { header: 'Employees', numeric: true },
          { header: labels.monthly, numeric: true },
          { header: labels.annual, numeric: true },
        ]}
        rows={data.countries.map((country) => ({
          key: country.countryCode,
          cells: [
            COUNTRIES[country.countryCode].name,
            formatCount(country.headcount),
            money(country.monthlyCost),
            money(country.annualCost),
          ],
        }))}
      />
    </DashboardSection>
  );
}
