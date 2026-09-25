import { formatMoney, type CostByDepartmentResponse } from '@salary/shared';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRateDate } from '../currency/rates.ts';
import { CHART, TOOLTIP_CLASS } from './chart-style.ts';
import { DashboardSection, type SectionStatus } from './DashboardSection.tsx';
import { MEASURE_LABELS, formatCompactMoney, formatCount } from './format.ts';
import { StatTable } from './StatTable.tsx';

const ROW_HEIGHT = 32;
const AXIS_HEIGHT = 32;

/** Annual cost per department as bars, largest first, with a table of the same figures. */
export function DepartmentSection({
  data,
  status,
}: {
  data: CostByDepartmentResponse | undefined;
  status: SectionStatus;
}) {
  const items = data?.items ?? [];
  const labels = MEASURE_LABELS[data?.measure ?? 'total'];
  const currency = items[0]?.annualCost.currency ?? 'USD';
  const rows = items.map((item) => ({ name: item.department, value: item.annualCost.amountMinor }));
  const height = rows.length * ROW_HEIGHT + AXIS_HEIGHT;

  let note: string | null = null;
  if (data?.rateDate && data.countryCode === null) {
    note = `Every country added up in US dollars at rates of ${formatRateDate(data.rateDate)}.`;
  } else if (data?.rateDate) {
    note = `US dollars at rates of ${formatRateDate(data.rateDate)}.`;
  }

  return (
    <DashboardSection id="departments" title="Cost by department" status={status}>
      {data && items.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No employees in this view.</p>
      )}
      {items.length > 0 && (
        <>
          <figure aria-labelledby="departments-caption" className="mt-4">
            <figcaption id="departments-caption" className="sr-only">
              {labels.annual} by department chart
            </figcaption>
            <ResponsiveContainer
              width="100%"
              height={height}
              initialDimension={{ width: 720, height }}
            >
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
              >
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis
                  type="number"
                  tick={CHART.tick}
                  stroke={CHART.grid}
                  tickFormatter={(value: number) => formatCompactMoney(value, currency)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={CHART.tick}
                  stroke={CHART.grid}
                />
                <Tooltip
                  cursor={CHART.cursor}
                  content={({ label }) => {
                    const item = items.find((entry) => entry.department === label);
                    return item ? (
                      <div className={TOOLTIP_CLASS}>
                        <p className="font-medium">{item.department}</p>
                        <p className="tabular-nums">
                          {formatMoney(item.annualCost.amountMinor, item.annualCost.currency)} a
                          year
                        </p>
                        <p className="tabular-nums text-muted-foreground">
                          {formatMoney(item.monthlyCost.amountMinor, item.monthlyCost.currency)} a
                          month
                        </p>
                      </div>
                    ) : null;
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={CHART.series}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={CHART.barSize}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </figure>
          {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
          <StatTable
            label="Cost by department"
            className="mt-4"
            columns={[
              { header: 'Department' },
              { header: 'Employees', numeric: true },
              { header: labels.monthly, numeric: true },
              { header: labels.annual, numeric: true },
            ]}
            rows={items.map((item) => ({
              key: item.department,
              cells: [
                item.department,
                formatCount(item.headcount),
                formatMoney(item.monthlyCost.amountMinor, item.monthlyCost.currency),
                formatMoney(item.annualCost.amountMinor, item.annualCost.currency),
              ],
            }))}
          />
        </>
      )}
    </DashboardSection>
  );
}
