import {
  COUNTRIES,
  COUNTRY_CODES,
  formatMoney,
  type CountryCode,
  type InsightsQuery,
  type Money,
} from '@salary/shared';
import { useState } from 'react';
import { SelectField } from '../components/select-field.tsx';
import { formatRateDate } from '../currency/rates.ts';
import { useJobTitlePay } from './api.ts';
import { DashboardSection } from './DashboardSection.tsx';
import { formatCount } from './format.ts';
import { StatTable } from './StatTable.tsx';

const money = (amount: Money) => formatMoney(amount.amountMinor, amount.currency);

/**
 * Average and median pay per job title within one country (F7). On the all-countries view a
 * global HR user picks the country here; otherwise the dashboard's country is used.
 */
export function JobTitleSection({
  query,
  chooseCountry,
}: {
  query: InsightsQuery;
  /** Whether this section needs its own country choice (global HR, all countries). */
  chooseCountry: boolean;
}) {
  const [picked, setPicked] = useState<CountryCode>(COUNTRY_CODES[0] ?? 'US');
  const country = chooseCountry ? picked : query.country;
  const titles = useJobTitlePay(query, country);
  const data = titles.data;

  return (
    <DashboardSection
      id="job-titles"
      title="Pay by job title"
      description="Annual pay of employees with current pay, per job title within a country."
      status={titles}
      actions={
        chooseCountry && (
          <div className="w-56">
            <SelectField
              id="job-titles-country"
              label="Country for job titles"
              value={picked}
              onValueChange={(value) => {
                const next = COUNTRY_CODES.find((code) => code === value);
                if (next) setPicked(next);
              }}
              options={COUNTRY_CODES.map((code) => ({ value: code, label: COUNTRIES[code].name }))}
            />
          </div>
        )
      }
    >
      {data?.items.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No employees with pay in this view.</p>
      )}
      {data && data.items.length > 0 && (
        <>
          {data.rateDate && (
            <p className="mt-2 text-sm text-muted-foreground">
              US dollars at rates of {formatRateDate(data.rateDate)}
            </p>
          )}
          <StatTable
            label="Pay by job title"
            className="mt-4 max-h-[28rem] overflow-y-auto"
            columns={[
              { header: 'Job title' },
              { header: 'Employees', numeric: true },
              { header: 'Average', numeric: true },
              { header: 'Median', numeric: true },
              { header: 'Lowest', numeric: true },
              { header: 'Highest', numeric: true },
            ]}
            rows={data.items.map((item) => ({
              key: item.jobTitle,
              cells: [
                item.jobTitle,
                formatCount(item.headcount),
                money(item.average),
                money(item.median),
                money(item.minimum),
                money(item.maximum),
              ],
            }))}
          />
        </>
      )}
    </DashboardSection>
  );
}
