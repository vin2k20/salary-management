import {
  COUNTRIES,
  formatMoney,
  type CurrencyCode,
  type PayRange,
  type PayRangeByCountryResponse,
} from '@salary/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';
import { formatRateDate } from '../currency/rates.ts';
import { CHART, TOOLTIP_CLASS } from './chart-style.ts';
import { DashboardSection, type SectionStatus } from './DashboardSection.tsx';
import { formatCompactMoney, formatCount } from './format.ts';
import { StatTable } from './StatTable.tsx';

interface RangeDatum {
  name: string;
  /** Lowest and highest pay: the bar spans them, and the shape draws the box inside. */
  range: [number, number];
  item: PayRange;
}

const ROW_HEIGHT = 48;
const AXIS_HEIGHT = 32;

/**
 * A box plot drawn inside the bar's span: whiskers from the lowest to the highest pay, a box over
 * the middle half (lower to upper quartile) and a surface-coloured gap at the median.
 */
function boxPlot(rows: RangeDatum[]) {
  return function BoxPlotShape({ x, y, width, height, index }: BarShapeProps) {
    const item = rows[index]?.item;
    if (!item) return <g />;
    const low = item.minimum.amountMinor;
    const span = item.maximum.amountMinor - low;
    const at = (amount: number) => (span === 0 ? x : x + ((amount - low) / span) * width);
    const middle = y + height / 2;
    const boxHeight = Math.min(height, CHART.barSize);
    const boxTop = middle - boxHeight / 2;
    const q1 = at(item.lowerQuartile.amountMinor);
    const q3 = at(item.upperQuartile.amountMinor);
    const median = at(item.median.amountMinor);
    return (
      <g>
        <line
          x1={x}
          x2={x + width}
          y1={middle}
          y2={middle}
          stroke={CHART.seriesSoft}
          strokeWidth={2}
        />
        {[x, x + width].map((end) => (
          <line
            key={end}
            x1={end}
            x2={end}
            y1={middle - boxHeight / 4}
            y2={middle + boxHeight / 4}
            stroke={CHART.seriesSoft}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        <rect
          x={q1}
          y={boxTop}
          width={Math.max(q3 - q1, 2)}
          height={boxHeight}
          rx={2}
          fill={CHART.series}
        />
        <line
          x1={median}
          x2={median}
          y1={boxTop}
          y2={boxTop + boxHeight}
          stroke={CHART.surface}
          strokeWidth={2}
        />
      </g>
    );
  };
}

function RangeTooltip({ rows, label }: { rows: RangeDatum[]; label: unknown }) {
  const item = rows.find((row) => row.name === label)?.item;
  if (!item) return null;
  const lines: [string, number][] = [
    ['Highest', item.maximum.amountMinor],
    ['Upper quartile', item.upperQuartile.amountMinor],
    ['Median', item.median.amountMinor],
    ['Lower quartile', item.lowerQuartile.amountMinor],
    ['Lowest', item.minimum.amountMinor],
  ];
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="font-medium">{COUNTRIES[item.countryCode].name}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 tabular-nums">
        {lines.map(([name, amount]) => (
          <div key={name} className="contents">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="text-right">{formatMoney(amount, item.median.currency)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One chart for countries that share a currency, on one scale. */
function RangeChart({ items, currency }: { items: PayRange[]; currency: CurrencyCode }) {
  const rows: RangeDatum[] = items.map((item) => ({
    name: COUNTRIES[item.countryCode].name,
    range: [item.minimum.amountMinor, item.maximum.amountMinor],
    item,
  }));
  const height = rows.length * ROW_HEIGHT + AXIS_HEIGHT;
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 720, height }}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis
          type="number"
          domain={[0, 'auto']}
          tick={CHART.tick}
          stroke={CHART.grid}
          tickFormatter={(value: number) => formatCompactMoney(value, currency)}
        />
        <YAxis type="category" dataKey="name" width={112} tick={CHART.tick} stroke={CHART.grid} />
        <Tooltip
          cursor={CHART.cursor}
          content={({ label }) => <RangeTooltip rows={rows} label={label} />}
        />
        <Bar dataKey="range" shape={boxPlot(rows)} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Pay range per country as a box plot with a table of the same figures. Countries in different
 * currencies cannot share a scale, so each then gets its own chart.
 */
export function PayRangeSection({
  data,
  status,
  oneCountry,
}: {
  data: PayRangeByCountryResponse | undefined;
  status: SectionStatus;
  oneCountry: boolean;
}) {
  const items = data?.items ?? [];
  const currencies = [...new Set(items.map((item) => item.median.currency))];
  const groups = currencies.length > 1 ? items.map((item) => [item]) : [items];

  return (
    <DashboardSection
      id="pay-range"
      title={oneCountry ? 'Pay range' : 'Pay range by country'}
      description="Annual pay of employees with current pay: the box spans the middle half, the gap in it marks the median and the lines reach the lowest and highest pay."
      status={status}
    >
      {data && items.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No employees with pay in this view.</p>
      )}
      {items.length > 0 && (
        <>
          <figure aria-labelledby="pay-range-caption" className="mt-4">
            <figcaption id="pay-range-caption" className="sr-only">
              Pay range chart
            </figcaption>
            {groups.length > 1 && (
              <p className="mb-2 text-sm text-muted-foreground">
                Countries are in different currencies, so each has its own scale. Show amounts in
                USD to compare them on one scale.
              </p>
            )}
            {groups.map((group) => (
              <RangeChart
                key={group.map((item) => item.countryCode).join()}
                items={group}
                currency={group[0]?.median.currency ?? 'USD'}
              />
            ))}
          </figure>
          {data?.rateDate && (
            <p className="mt-2 text-sm text-muted-foreground">
              US dollars at rates of {formatRateDate(data.rateDate)}
            </p>
          )}
          <StatTable
            label="Pay range"
            className="mt-4"
            columns={[
              { header: 'Country' },
              { header: 'Employees', numeric: true },
              { header: 'Lowest', numeric: true },
              { header: 'Lower quartile', numeric: true },
              { header: 'Median', numeric: true },
              { header: 'Upper quartile', numeric: true },
              { header: 'Highest', numeric: true },
              { header: 'Average', numeric: true },
            ]}
            rows={items.map((item) => ({
              key: item.countryCode,
              cells: [
                COUNTRIES[item.countryCode].name,
                formatCount(item.headcount),
                ...[
                  item.minimum,
                  item.lowerQuartile,
                  item.median,
                  item.upperQuartile,
                  item.maximum,
                  item.average,
                ].map((amount) => formatMoney(amount.amountMinor, amount.currency)),
              ],
            }))}
          />
        </>
      )}
    </DashboardSection>
  );
}
